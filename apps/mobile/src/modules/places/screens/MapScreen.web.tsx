import { router } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { POI, PoiCategory, PoiRegionSummary } from '@lazynavy-v3/types'
import { listPoisApi, listPoiSummariesApi } from '../api/client'
import { localizeMooring, localizeSeabed } from '../utils/present'
import { bottomNav } from '../../../navigation/navConfig'
import { useTheme } from '../../../theme'
import { useI18n } from '../../../i18n'

type LeafletGlobal = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => any
  tileLayer: (url: string, options?: Record<string, unknown>) => any
  divIcon: (options?: Record<string, unknown>) => any
  marker: (latlng: [number, number], options?: Record<string, unknown>) => any
}

const LEAFLET_CSS_ID = 'lazynavy-leaflet-css'
const LEAFLET_SCRIPT_ID = 'lazynavy-leaflet-script'
const LEAFLET_FIXES_ID = 'lazynavy-leaflet-layout-fixes'
const DEFAULT_CENTER: [number, number] = [38.463, 14.9672]
const SUMMARY_ZOOM = 4
const DETAIL_ZOOM = 9
const CENTER_FETCH_ZOOM = 6
const DEFAULT_MAP_STYLE = 'standard'
const DEFAULT_RECENT_SEARCHES = ['亚龙湾', '三亚湾码头', '可预订锚地']
const COMMON_TAGS = ['补给', '燃油', '餐厅', '修船', '淡水', '避风']

const POI_TYPES: { id: PoiCategory | 'all'; label: string; color: string }[] = [
  { id: 'all', label: '全部', color: '#0ea5e9' },
  { id: 'marina', label: '码头', color: '#0ea5e9' },
  { id: 'anchorage', label: '锚地', color: '#34d399' },
  { id: 'dry_dock', label: '干船坞', color: '#ef4444' },
  { id: 'buoy_mooring', label: '浮标泊位', color: '#f59e0b' },
  { id: 'public_quay', label: '公共泊靠', color: '#a78bfa' },
  { id: 'hazard', label: '限制/风险', color: '#f87171' },
]

const TYPE_ICONS: Record<string, string> = {
  marina: '⚓',
  anchorage: '⌾',
  dry_dock: '🛠',
  buoy_mooring: '●',
  public_quay: '▤',
  hazard: '!',
  fuel: '⛽',
  yacht_club: '🛥',
  other: '•',
}

// 按 subtype/category 区分图标(web marker)。
function iconForPoi(poi: Pick<POI, 'category' | 'subtype' | 'kind'>): string {
  return (
    (poi.subtype && poi.subtype !== poi.category ? TYPE_ICONS[poi.subtype] : undefined) ??
    TYPE_ICONS[poi.category] ??
    (poi.kind ? TYPE_ICONS[poi.kind] : undefined) ??
    TYPE_ICONS.other
  )
}

function colorForCategory(category: PoiCategory | 'all') {
  return POI_TYPES.find((item) => item.id === category)?.color ?? '#0ea5e9'
}

function labelForCategory(category: PoiCategory) {
  return POI_TYPES.find((item) => item.id === category)?.label ?? '其他'
}

function shortInfoOf(poi: POI, text: (source: string, vars?: Record<string, string | number>) => string) {
  const pieces: string[] = []
  if (poi.region) pieces.push(poi.region)
  if (poi.maxDraft) pieces.push(text('吃水 {draft}m', { draft: poi.maxDraft }))
  if (poi.maxLength) pieces.push(text('船长 {length}m', { length: poi.maxLength }))
  if (poi.seabeds.length) pieces.push(poi.seabeds.slice(0, 2).map((value) => localizeSeabed(value, text)).join('/'))
  if (poi.bookable) pieces.push(text('可预订'))
  return pieces.slice(0, 2).join(' · ') || text('基础地标资料已同步')
}

function markerHtml(poi: POI, selected: boolean) {
  const color = colorForCategory(poi.category)
  const icon = iconForPoi(poi)
  const size = selected ? 34 : 30
  const fontSize = icon.length > 1 ? 14 : 16
  return `
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:${size / 2}px;
      background:${color};
      border:2px solid #ffffff;
      box-shadow:0 8px 18px rgba(0,0,0,0.22);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-size:${fontSize}px;
      font-weight:700;
      line-height:1;
    ">${icon}</div>
  `
}

function summaryMarkerHtml(summary: PoiRegionSummary) {
  const size = Math.max(18, Math.min(26, 15 + Math.min(summary.count, 10) * 0.5))
  return `
    <div style="
      width:${size}px;
      height:${size}px;
      padding:0;
      border-radius:${size / 2}px;
      background:rgba(14,165,233,0.92);
      border:1.25px solid rgba(255,255,255,0.94);
      box-shadow:0 4px 12px rgba(14,165,233,0.24);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-size:9px;
      font-weight:700;
      line-height:1;
    ">${summary.count}</div>
  `
}

function ensureLeafletAssets() {
  const browser = globalThis as typeof globalThis & {
    document?: any
    L?: LeafletGlobal
  }
  const doc = browser.document
  if (!doc) throw new Error('document is unavailable')

  if (!doc.getElementById(LEAFLET_CSS_ID)) {
    const link = doc.createElement('link')
    link.id = LEAFLET_CSS_ID
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    doc.head.appendChild(link)
  }

  if (!doc.getElementById(LEAFLET_FIXES_ID)) {
    const style = doc.createElement('style')
    style.id = LEAFLET_FIXES_ID
    style.textContent = `
      .leaflet-container { width: 100%; height: 100%; }
      .leaflet-control-attribution {
        margin-right: 16px !important;
        margin-bottom: 104px !important;
        border-radius: 999px 0 0 999px;
        padding: 3px 8px !important;
        background: rgba(255,255,255,0.88) !important;
        font-size: 10px !important;
        line-height: 14px !important;
      }
      .leaflet-control-container { pointer-events: none; }
      .leaflet-control-container .leaflet-control { pointer-events: auto; }
    `
    doc.head.appendChild(style)
  }

  const existingScript = doc.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null
  if (existingScript) {
    return existingScript
  }

  const script = doc.createElement('script')
  script.id = LEAFLET_SCRIPT_ID
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  script.async = true
  doc.body.appendChild(script)
  return script
}

export default function MapScreenWeb() {
  const t = useTheme()
  const { text } = useI18n()
  const mapRef = useRef<HTMLDivElement | null>(null)
  const searchWrapRef = useRef<HTMLDivElement | null>(null)
  const leafletMapRef = useRef<any>(null)
  const standardLayerRef = useRef<any>(null)
  const satelliteLayerRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [viewportWidth, setViewportWidth] = useState(1024)
  const [zoom, setZoom] = useState(6)
  const [center, setCenter] = useState(DEFAULT_CENTER)
  const [boundsVersion, setBoundsVersion] = useState(0)
  const [filter, setFilter] = useState<PoiCategory | 'all'>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [recentSearches, setRecentSearches] = useState(DEFAULT_RECENT_SEARCHES)
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>(DEFAULT_MAP_STYLE)
  const [summaries, setSummaries] = useState<PoiRegionSummary[]>([])
  const [pois, setPois] = useState<POI[]>([])
  const [visiblePois, setVisiblePois] = useState<POI[]>([])
  const [loadingPois, setLoadingPois] = useState(false)
  const [poiError, setPoiError] = useState<string | null>(null)
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null)
  const [detailTab, setDetailTab] = useState<'详情' | '评价' | '照片'>('详情')
  const [savedPoiIds, setSavedPoiIds] = useState<string[]>([])
  const shouldReadSummaries = zoom >= SUMMARY_ZOOM
  const shouldReadPois = zoom >= DETAIL_ZOOM
  const shouldFetchByCenter = zoom >= CENTER_FETCH_ZOOM
  const isPhone = viewportWidth < 720

  function clearMarkers() {
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []
  }

  function rememberSearch(term: string) {
    const next = term.trim()
    if (!next) return
    setRecentSearches((current) => [next, ...current.filter((item) => item !== next)].slice(0, 6))
  }

  function applySearch(term: string) {
    const next = term.trim()
    setSearchDraft(next)
    setQuery(next)
    rememberSearch(next)
  }

  function applyType(type: PoiCategory | 'all') {
    setFilter(type)
  }

  function removeRecentSearch(term: string) {
    setRecentSearches((current) => current.filter((item) => item !== term))
  }

  function clearRecentSearches() {
    setRecentSearches([])
  }

  function toggleSavedPoi(id: string) {
    setSavedPoiIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id])
  }

  useEffect(() => {
    if (selectedPoi) {
      setDetailTab('详情')
    }
  }, [selectedPoi?.id])

  useEffect(() => {
    const browser = globalThis as typeof globalThis & {
      innerWidth?: number
      addEventListener?: (type: string, listener: () => void) => void
      removeEventListener?: (type: string, listener: () => void) => void
    }
    if (!browser.addEventListener || !browser.removeEventListener) return

    const sync = () => setViewportWidth(browser.innerWidth ?? 1024)
    sync()
    browser.addEventListener('resize', sync)
    return () => browser.removeEventListener?.('resize', sync)
  }, [])

  useEffect(() => {
    const browser = globalThis as typeof globalThis & {
      document?: any
    }
    const doc = browser.document
    if (!doc) return

    const closeOnOutside = (event: any) => {
      const target = event?.target
      const searchRoot = searchWrapRef.current as any
      if (!searchRoot || (target && searchRoot.contains?.(target))) return
      setSearchActive(false)
    }

    doc.addEventListener('mousedown', closeOnOutside)
    return () => doc.removeEventListener('mousedown', closeOnOutside)
  }, [])

  useEffect(() => {
    const browser = globalThis as typeof globalThis & {
      document?: any
      L?: LeafletGlobal
    }
    if (!browser.document) return

    let cancelled = false
    const script = ensureLeafletAssets()

    const initMap = () => {
      if (cancelled || !mapRef.current || !browser.L || leafletMapRef.current) return

      const map = browser.L.map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: 6,
        zoomControl: false,
        attributionControl: true,
      })

      standardLayerRef.current = browser.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      })

      satelliteLayerRef.current = browser.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18,
      })

      standardLayerRef.current.addTo(map)

      map.on('moveend zoomend', () => {
        const nextCenter = map.getCenter()
        setCenter([nextCenter.lat, nextCenter.lng])
        setZoom(map.getZoom())
        setBoundsVersion((value) => value + 1)
      })

      leafletMapRef.current = map
      setStatus('ready')
    }

    const onLoad = () => {
      initMap()
    }

    const onError = () => {
      if (!cancelled) setStatus('error')
    }

    if (browser.L) {
      initMap()
    } else {
      script.addEventListener('load', onLoad)
      script.addEventListener('error', onError)
    }

    return () => {
      cancelled = true
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
      clearMarkers()
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = leafletMapRef.current
    const standardLayer = standardLayerRef.current
    const satelliteLayer = satelliteLayerRef.current
    if (!map || !standardLayer || !satelliteLayer) return

    if (mapStyle === 'satellite') {
      if (map.hasLayer?.(standardLayer)) map.removeLayer(standardLayer)
      if (!map.hasLayer?.(satelliteLayer)) satelliteLayer.addTo(map)
      return
    }

    if (map.hasLayer?.(satelliteLayer)) map.removeLayer(satelliteLayer)
    if (!map.hasLayer?.(standardLayer)) standardLayer.addTo(map)
  }, [mapStyle])

  useEffect(() => {
    if (status !== 'ready') return

    if (!shouldReadSummaries) {
      setSummaries([])
      setPois([])
      setVisiblePois([])
      setSelectedPoi(null)
      setPoiError(null)
      setLoadingPois(false)
      clearMarkers()
      return
    }

    let cancelled = false
    async function loadMapData() {
      setLoadingPois(true)
      setPoiError(null)
      try {
        const baseFilters = {
          category: filter,
          q: query.trim() || undefined,
          ...(shouldFetchByCenter
            ? {
                lat: center[0],
                lng: center[1],
                zoom,
              }
            : {}),
        }
        const [summaryData, poiData] = await Promise.all([
          listPoiSummariesApi({
            ...baseFilters,
            limit: 160,
          }),
          shouldReadPois
            ? listPoisApi({
                ...baseFilters,
                limit: 1500,
              })
            : Promise.resolve([]),
        ])
        if (!cancelled) {
          setSummaries(summaryData)
          setPois(poiData)
        }
      } catch (err: any) {
        if (!cancelled) {
          setPoiError(err?.message ?? text('加载地标失败'))
          setSummaries([])
          setPois([])
        }
      } finally {
        if (!cancelled) {
          setLoadingPois(false)
        }
      }
    }

    void loadMapData()
    return () => {
      cancelled = true
    }
  }, [center, filter, query, shouldFetchByCenter, shouldReadPois, shouldReadSummaries, status, zoom])

  useEffect(() => {
    if (status !== 'ready' || !leafletMapRef.current) return
    if (!shouldReadSummaries) {
      clearMarkers()
      setVisiblePois([])
      setSelectedPoi(null)
      return
    }

    const map = leafletMapRef.current
    const browser = globalThis as typeof globalThis & { L?: LeafletGlobal }
    if (!browser.L) return

    clearMarkers()
    const bounds = map.getBounds()

    if (!shouldReadPois) {
      const nextSummaries = summaries
        .filter((summary) => bounds.contains([summary.location.lat, summary.location.lng]))
        .slice(0, 120)

      nextSummaries.forEach((summary) => {
        const marker = browser.L!.marker([summary.location.lat, summary.location.lng], {
          icon: browser.L!.divIcon({
            className: 'lazynavy-poi-summary-marker',
            html: summaryMarkerHtml(summary),
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
        }).addTo(map)

        marker.on('click', () => {
          map.flyTo([summary.location.lat, summary.location.lng], Math.max(DETAIL_ZOOM + 1, zoom + 4), {
            animate: true,
            duration: 0.6,
          })
        })
        markersRef.current.push(marker)
      })

      setVisiblePois([])
      setSelectedPoi(null)
      return
    }

    const nextVisible = pois.filter((poi) => bounds.contains([poi.location.lat, poi.location.lng])).slice(0, 250)

    nextVisible.forEach((poi) => {
      const selected = selectedPoi?.id === poi.id
      const marker = browser.L!.marker([poi.location.lat, poi.location.lng], {
        icon: browser.L!.divIcon({
          className: 'lazynavy-poi-marker',
          html: markerHtml(poi, selected),
          iconSize: [selected ? 34 : 30, selected ? 34 : 30],
          iconAnchor: [selected ? 17 : 15, selected ? 17 : 15],
        }),
      }).addTo(map)

      marker.on('click', () => {
        setSelectedPoi(poi)
      })
      markersRef.current.push(marker)
    })

    setVisiblePois(nextVisible)
    setSelectedPoi((current) => {
      if (!current) return null
      return nextVisible.find((poi) => poi.id === current.id) ?? nextVisible[0] ?? null
    })
  }, [boundsVersion, pois, selectedPoi?.id, shouldReadPois, shouldReadSummaries, status, summaries, zoom])

  const styles = useMemo(() => ({
    page: {
      height: '100vh',
      background: t.bg,
      color: t.text,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden' as const,
    },
    top: {
      position: 'absolute' as const,
      top: 20,
      left: 18,
      right: 18,
      zIndex: 700,
      display: 'grid',
      gap: 10,
    },
    mapWrap: {
      position: 'relative' as const,
      flex: 1,
      minHeight: 0,
      overflow: 'hidden' as const,
      background: t.surface,
    },
    map: {
      width: '100%',
      height: '100%',
      minHeight: '100%',
    },
    mapStyleBtn: {
      position: 'absolute' as const,
      top: 128,
      right: 18,
      zIndex: 620,
      width: 46,
      height: 46,
      border: '1px solid rgba(255,255,255,0.82)',
      borderRadius: 16,
      background: 'rgba(255,255,255,0.92)',
      boxShadow: '0 10px 24px rgba(148,163,184,0.22)',
      backdropFilter: 'blur(18px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#64748b',
    },
    searchCard: {
      padding: '0 14px 0 20px',
      borderRadius: 28,
      minHeight: 62,
      background: 'rgba(255,255,255,0.92)',
      color: t.text,
      border: '1px solid rgba(255,255,255,0.78)',
      display: 'grid',
      gap: 10,
      alignItems: 'stretch',
      boxShadow: '0 14px 34px rgba(148,163,184,0.22)',
      backdropFilter: 'blur(22px)',
    },
    searchRow: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 62,
      gap: 12,
      flexDirection: 'row' as const,
      width: '100%',
    },
    input: {
      flex: 1,
      width: '100%',
      border: 'none',
      background: 'transparent',
      color: t.text,
      borderRadius: 0,
      height: 62,
      padding: 0,
      outline: 'none',
      fontSize: 18,
      fontWeight: 400,
      letterSpacing: '-0.02em',
    },
    btn: {
      border: 'none',
      background: 'transparent',
      color: 'rgba(100,116,139,0.9)',
      borderRadius: 999,
      height: 42,
      width: 42,
      padding: 0,
      fontWeight: 400,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: 0,
    },
    chipsRow: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap' as const,
      padding: 0,
    },
    searchPanel: {
      margin: '0 4px 4px',
      padding: '4px 2px 16px',
      display: 'grid',
      gap: 16,
      width: '100%',
      gridColumn: '1 / -1',
    },
    searchSection: {
      display: 'grid',
      gap: 10,
    },
    searchSectionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingLeft: 4,
    },
    searchSectionTitle: {
      color: 'rgba(100,116,139,0.88)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
    },
    sectionAction: {
      border: 'none',
      background: 'transparent',
      color: '#94a3b8',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      padding: 0,
    },
    recentTags: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap' as const,
    },
    recentTag: {
      border: '1px solid rgba(226,232,240,0.95)',
      background: 'rgba(255,255,255,0.68)',
      borderRadius: 999,
      padding: '8px 8px 8px 12px',
      color: t.text,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(148,163,184,0.12)',
      textAlign: 'left' as const,
    },
    recentTagLabel: {
      color: t.text,
      fontSize: 13.5,
      fontWeight: 500,
    },
    recentTagRemove: {
      width: 22,
      height: 22,
      borderRadius: 11,
      border: 'none',
      background: 'rgba(226,232,240,0.88)',
      color: '#64748b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      padding: 0,
      fontSize: 13,
      lineHeight: 1,
      flexShrink: 0,
    },
    filterChip: {
      border: '1px solid rgba(226,232,240,0.95)',
      background: 'rgba(255,255,255,0.78)',
      color: '#64748b',
      borderRadius: 999,
      padding: '9px 12px',
      fontSize: 12.5,
      fontWeight: 700,
      cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(148,163,184,0.12)',
    },
    error: {
      position: 'absolute' as const,
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.surface,
      color: t.textDim,
      fontSize: 14,
    },
    bottomNav: {
      position: 'fixed' as const,
      left: 12,
      right: 12,
      bottom: 20,
      height: 58,
      zIndex: 740,
      borderRadius: 16,
      background: 'rgba(244,252,255,0.94)',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: '0 8px 14px rgba(7,89,133,0.14)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      overflow: 'hidden' as const,
      backdropFilter: 'blur(18px)',
    },
    navItem: {
      flex: 1,
      height: 48,
      border: 0,
      borderRight: '1px solid rgba(14,116,144,0.12)',
      background: 'transparent',
      color: '#123047',
      display: 'grid',
      placeItems: 'center',
      alignContent: 'center',
      gap: 2,
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    navIcon: {
      color: '#0e7490',
      fontSize: 24,
      fontWeight: 900,
      lineHeight: 1,
    },
    navText: {
      color: '#123047',
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1.1,
    },
    modalBackdrop: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 760,
      background: 'rgba(7,29,54,0.22)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: isPhone ? 'stretch' : 'center',
      justifyContent: 'center',
      padding: isPhone ? '58px 6px 74px' : '36px 20px 42px',
    },
    modalCard: {
      width: '100%',
      maxWidth: isPhone ? '100%' : 860,
      height: '100%',
      maxHeight: isPhone ? '100%' : 'calc(100vh - 78px)',
      borderRadius: isPhone ? 30 : 34,
      border: `1px solid ${t.border}`,
      background: 'rgba(255,255,255,0.96)',
      boxShadow: '0 18px 60px rgba(15,23,42,0.18)',
      backdropFilter: 'blur(18px)',
      overflow: 'hidden' as const,
      display: 'grid',
      gridTemplateRows: isPhone ? '290px minmax(0, 1fr)' : '320px minmax(0, 1fr)',
    },
    hero: {
      position: 'relative' as const,
      background: 'linear-gradient(135deg, rgba(14,165,233,0.22), rgba(13,52,96,0.08))',
      overflow: 'hidden' as const,
    },
    heroImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    },
    heroFallback: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: t.accent,
      fontSize: 48,
      fontWeight: 700,
    },
    heroOverlay: {
      position: 'absolute' as const,
      inset: 0,
      background: 'linear-gradient(180deg, rgba(7,29,54,0.28) 0%, rgba(7,29,54,0.08) 26%, rgba(7,29,54,0.32) 62%, rgba(7,29,54,0.74) 100%)',
    },
    modalTopBar: {
      position: 'absolute' as const,
      top: 14,
      left: 14,
      right: 14,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      zIndex: 2,
    },
    modalTopActions: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    modalType: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      padding: '7px 10px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      backdropFilter: 'blur(8px)',
    },
    modalGhostBtn: {
      border: 'none',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.9)',
      color: '#64748b',
      height: 36,
      minWidth: 36,
      padding: '0 12px',
      fontSize: 15,
      cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(148,163,184,0.18)',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontWeight: 600,
    },
    modalCloseBtn: {
      border: 'none',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.92)',
      color: '#64748b',
      height: 36,
      width: 36,
      fontSize: 18,
      cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(148,163,184,0.18)',
      flexShrink: 0,
    },
    heroInfo: {
      position: 'absolute' as const,
      left: 18,
      right: 18,
      bottom: 18,
      zIndex: 2,
      display: 'grid',
      gap: 6,
    },
    heroTitle: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      textShadow: '0 4px 18px rgba(7,29,54,0.42)',
    },
    heroMeta: {
      color: 'rgba(255,255,255,0.92)',
      fontSize: 13,
      lineHeight: 1.6,
      textShadow: '0 2px 12px rgba(7,29,54,0.34)',
    },
    heroSummary: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 12.5,
      lineHeight: 1.55,
      textShadow: '0 2px 10px rgba(7,29,54,0.30)',
    },
    panelScroll: {
      overflow: 'auto' as const,
      padding: 0,
    },
    detailContent: {
      padding: 14,
      display: 'grid',
      gap: 12,
    },
    quickActions: {
      display: 'grid',
      gridTemplateColumns: '44px 44px',
      justifyContent: 'end',
      gap: 8,
    },
    iconAction: {
      width: 44,
      height: 42,
      borderRadius: 12,
      border: `0.5px solid ${t.border}`,
      background: '#fff',
      color: t.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 17,
      cursor: 'pointer',
    },
    tabsRow: {
      display: 'flex',
      gap: 18,
      padding: '4px 0 0',
      borderBottom: `0.5px solid ${t.border}`,
    },
    tabBtn: {
      appearance: 'none' as const,
      border: 0,
      background: 'transparent',
      padding: '8px 0',
      position: 'relative' as const,
      fontSize: 14,
      cursor: 'pointer',
      fontWeight: 500,
      color: t.textDim,
    },
    activeTabLine: {
      position: 'absolute' as const,
      bottom: -1,
      left: 0,
      right: 0,
      height: 2,
      background: t.accent,
    },
    noticeStrip: {
      padding: '10px 12px',
      borderRadius: 12,
      background: 'rgba(251,146,60,0.10)',
      border: '0.5px solid rgba(251,146,60,0.30)',
      fontSize: 12,
      color: '#ea8b2f',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
    },
    noticeMark: {
      width: 18,
      height: 18,
      borderRadius: 9,
      background: '#fb923c',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 11,
      flexShrink: 0,
      marginTop: 1,
    },
    sectionCard: {
      borderRadius: 16,
      background: '#fff',
      border: `0.5px solid ${t.border}`,
      padding: '14px 16px',
    },
    sectionKicker: {
      fontSize: 10,
      color: t.textDim,
      letterSpacing: '0.14em',
      marginBottom: 12,
      fontFamily: 'monospace',
    },
    vitalsGrid: {
      display: 'grid',
      gridTemplateColumns: isPhone ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
      gap: '14px 10px',
    },
    vitalLabel: {
      fontSize: 10,
      color: t.textSoft,
      marginBottom: 2,
    },
    vitalValue: {
      fontSize: 12.5,
      color: t.text,
      fontWeight: 500,
    },
    addressDivider: {
      height: 0.5,
      background: t.border,
      margin: '14px -16px',
    },
    helper: {
      color: t.textDim,
      fontSize: 12.5,
      lineHeight: 1.6,
    },
    amenitiesGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8,
    },
    amenityCard: {
      padding: '10px 8px',
      borderRadius: 10,
      background: t.elevated,
      textAlign: 'center' as const,
    },
    amenityValue: {
      fontSize: 14,
      fontWeight: 600,
      marginBottom: 3,
      color: t.text,
    },
    amenityLabel: {
      fontSize: 11,
      color: t.textDim,
    },
    reviewList: {
      display: 'grid',
      gap: 0,
    },
    reviewItem: {
      padding: '12px 0',
      borderBottom: `0.5px solid ${t.border}`,
    },
    reviewName: {
      fontSize: 13,
      fontWeight: 600,
      color: t.text,
    },
    reviewStars: {
      fontSize: 11,
      color: '#fbbf24',
      letterSpacing: '0.06em',
      marginTop: 2,
    },
    reviewText: {
      fontSize: 13,
      color: t.textDim,
      lineHeight: 1.55,
      marginTop: 6,
    },
    photosGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 4,
    },
    photoTile: {
      borderRadius: 8,
      overflow: 'hidden' as const,
      aspectRatio: '1 / 1',
      background: t.elevated,
    },
    photoTileImg: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    },
    detailBlock: {
      display: 'grid',
      gap: 12,
    },
    detailGrid: {
      display: 'grid',
      gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr',
      gap: 10,
    },
    detailCell: {
      borderRadius: 14,
      background: t.elevated,
      padding: 12,
    },
    detailLabel: {
      color: t.textDim,
      fontSize: 11,
      fontWeight: 700,
      marginBottom: 4,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    },
    detailValue: {
      color: t.text,
      fontSize: 13,
      lineHeight: 1.5,
    },
    tagRow: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap' as const,
      marginTop: 10,
    },
    tag: {
      borderRadius: 999,
      background: t.elevated,
      color: t.textDim,
      padding: '6px 10px',
      fontSize: 12,
      fontWeight: 700,
    },
    detailList: {
      display: 'grid',
      gap: 10,
    },
    detailListRow: {
      display: 'grid',
      gridTemplateColumns: isPhone ? '72px minmax(0, 1fr)' : '92px minmax(0, 1fr)',
      gap: 10,
      alignItems: 'start',
    },
    detailListKey: {
      fontSize: 11,
      color: t.textSoft,
      letterSpacing: '0.04em',
    },
    detailListValue: {
      fontSize: 13,
      color: t.text,
      lineHeight: 1.55,
    },
  }), [isPhone, t])

  function categoryLabel(category: PoiCategory) {
    return text(labelForCategory(category))
  }

  function renderDetailList(rows: Array<[string, string]>) {
    return (
      <div style={styles.detailList}>
        {rows.map(([label, value]) => (
          <div key={label} style={styles.detailListRow}>
            <div style={styles.detailListKey}>{label}</div>
            <div style={styles.detailListValue}>{value}</div>
          </div>
        ))}
      </div>
    )
  }

  function renderSourceModule(poi: POI) {
    return (
      <div style={styles.sectionCard}>
        <div style={styles.sectionKicker}>SOURCE · {text('数据来源')}</div>
        <div style={styles.helper}>{poi.sourceUrl ?? text('暂无来源链接')}</div>
      </div>
    )
  }

  function renderAmenityModule(items: Array<{ label: string; value: string }>) {
    return (
      <div style={styles.sectionCard}>
        <div style={styles.sectionKicker}>AMENITIES · {text('设施')}</div>
        <div style={styles.amenitiesGrid}>
          {items.map((item) => (
            <div key={item.label} style={styles.amenityCard}>
              <div style={{
                ...styles.amenityValue,
                color: item.value === '✓' ? t.success : item.value === '✗' ? t.textSoft : t.text,
                fontFamily: item.value.length <= 4 ? 'monospace' : 'inherit',
              }}>{item.value}</div>
              <div style={styles.amenityLabel}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderTagModule(tags: string[]) {
    if (!tags.length) return null
    return (
      <div style={styles.tagRow}>
        {tags.map((item) => <div key={item} style={styles.tag}>{item}</div>)}
      </div>
    )
  }

  function renderDetailModules(poi: POI) {
    const locationLabel = poi.address ?? poi.region ?? poi.country ?? text('未知海域')
    const coords = `${poi.location.lat.toFixed(4)}, ${poi.location.lng.toFixed(4)}`
    const seabedLabels = poi.seabeds.map((value) => localizeSeabed(value, text))
    const mooringLabels = poi.mooringTypes.map((value) => localizeMooring(value, text))
    const commonTags = [
      poi.region,
      poi.bookable ? text('可预订') : '',
      ...seabedLabels.slice(0, 2),
      ...poi.protections.slice(0, 3),
    ].filter(Boolean) as string[]

    if (poi.category === 'hazard') {
      return (
        <div style={styles.detailBlock}>
          <div style={styles.noticeStrip}>
            <div style={styles.noticeMark}>!</div>
            <div>{poi.description?.trim() || text('该区域存在航行限制或潜在风险，进入前请确认最新海况、通告与进出路线。')}</div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionKicker}>HAZARD AREA · {text('风险区域')}</div>
            {renderDetailList([
              [text('区域'), locationLabel],
              [text('坐标'), coords],
              [text('风险类型'), poi.type || categoryLabel(poi.category)],
              [text('影响对象'), poi.maxLength ? text('建议 {length}m 以下船只谨慎通过', { length: poi.maxLength }) : text('所有船只注意减速和观察')],
            ])}
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionKicker}>GUIDANCE · {text('航行建议')}</div>
            {renderDetailList([
              [text('海床/障碍'), seabedLabels.join(' / ') || text('未标注')],
              [text('风浪遮蔽'), poi.protections.join(' / ') || text('遮蔽有限')],
              [text('靠泊情况'), mooringLabels.join(' / ') || text('不建议停靠')],
              [text('备注'), poi.kind || text('建议白天通过并保持守听')],
            ])}
          </div>

          {renderTagModule(commonTags)}
          {renderSourceModule(poi)}
        </div>
      )
    }

    if (poi.category === 'anchorage' || poi.category === 'buoy_mooring') {
      return (
        <div style={styles.detailBlock}>
          <div style={styles.noticeStrip}>
            <div style={styles.noticeMark}>!</div>
            <div>{poi.description?.trim() || text('锚泊前建议再次确认海床类型、风向遮蔽与回旋范围。')}</div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionKicker}>ANCHORAGE · {text('锚泊条件')}</div>
            <div style={styles.vitalsGrid}>
              {[
                [text('水深'), poi.maxDraft ? `${poi.maxDraft} m` : text('暂无')],
                [text('船长'), poi.maxLength ? `${poi.maxLength} m` : text('未标注')],
                [text('坐标'), coords],
                [text('海床'), seabedLabels.join(' / ') || text('未标注')],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={styles.vitalLabel}>{k}</div>
                  <div style={{ ...styles.vitalValue, fontFamily: k === text('坐标') ? 'monospace' : 'inherit' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={styles.addressDivider} />
            <div style={styles.vitalLabel}>{text('区域')}</div>
            <div style={styles.vitalValue}>{locationLabel}</div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionKicker}>APPROACH · {text('进出与系泊')}</div>
            {renderDetailList([
              [text('遮蔽'), poi.protections.join(' / ') || text('未标注')],
              [text('系泊方式'), mooringLabels.join(' / ') || text('自由抛锚')],
              [text('可预订'), poi.bookable ? text('支持提前预订') : text('到场确认')],
              [text('备注'), poi.kind || text('建议保留足够回旋空间')],
            ])}
          </div>

          {renderAmenityModule([
            { label: text('可预订'), value: poi.bookable ? '✓' : '✗' },
            { label: text('双体友好'), value: poi.multihullFriendly ? '✓' : '—' },
            { label: text('海床'), value: seabedLabels[0] ?? '—' },
            { label: text('遮蔽'), value: poi.protections[0] ?? '—' },
            { label: text('浮球'), value: poi.category === 'buoy_mooring' ? '✓' : '—' },
            { label: text('来源'), value: poi.sourceUrl ? 'LINK' : '—' },
          ])}

          {renderTagModule(commonTags)}
          {renderSourceModule(poi)}
        </div>
      )
    }

    if (poi.category === 'dry_dock') {
      return (
        <div style={styles.detailBlock}>
          <div style={styles.noticeStrip}>
            <div style={styles.noticeMark}>!</div>
            <div>{poi.description?.trim() || text('进坞前建议提前预约档期，并确认船长、吃水和服务窗口。')}</div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionKicker}>SERVICE BAY · {text('服务能力')}</div>
            <div style={styles.vitalsGrid}>
              {[
                [text('船长'), poi.maxLength ? `${poi.maxLength} m` : text('暂无')],
                [text('吃水'), poi.maxDraft ? `${poi.maxDraft} m` : text('暂无')],
                [text('电话'), poi.phone ?? text('暂无')],
                [text('坐标'), coords],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={styles.vitalLabel}>{k}</div>
                  <div style={{ ...styles.vitalValue, fontFamily: k === text('坐标') ? 'monospace' : 'inherit' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={styles.addressDivider} />
            <div style={styles.vitalLabel}>{text('位置')}</div>
            <div style={styles.vitalValue}>{locationLabel}</div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionKicker}>WORKSCOPE · {text('服务范围')}</div>
            {renderDetailList([
              [text('设施类型'), poi.type || text('干船坞')],
              [text('靠泊方式'), mooringLabels.join(' / ') || text('岸靠作业')],
              [text('适航提示'), poi.protections.join(' / ') || text('进场前确认窗口')],
              [text('说明'), poi.kind || text('建议提前确认吊装与维修能力')],
            ])}
          </div>

          {renderAmenityModule([
            { label: text('可预订'), value: poi.bookable ? '✓' : '✗' },
            { label: text('双体友好'), value: poi.multihullFriendly ? '✓' : '—' },
            { label: text('吊装'), value: '—' },
            { label: text('维修'), value: '✓' },
            { label: text('电话'), value: poi.phone ? 'CALL' : '—' },
            { label: text('来源'), value: poi.sourceUrl ? 'LINK' : '—' },
          ])}

          {renderTagModule(commonTags)}
          {renderSourceModule(poi)}
        </div>
      )
    }

    const isPortLike = poi.category === 'marina' || poi.category === 'public_quay' || poi.category === 'other'
    if (isPortLike) {
      return (
        <div style={styles.detailBlock}>
          <div style={styles.noticeStrip}>
            <div style={styles.noticeMark}>!</div>
            <div>{poi.description?.trim() || text('当前地标已同步基础泊靠信息，进港前建议再次确认风向、海床与泊位条件。')}</div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionKicker}>PORT INFO · {text('港口信息')}</div>
            <div style={styles.vitalsGrid}>
              {[
                [text('水深'), poi.maxDraft ? `${poi.maxDraft} m` : text('暂无')],
                [text('泊位'), mooringLabels.length ? mooringLabels.join(' / ') : text('未标注')],
                [text('坐标'), coords],
                [text('电话'), poi.phone ?? text('暂无')],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={styles.vitalLabel}>{k}</div>
                  <div style={{ ...styles.vitalValue, fontFamily: k === text('坐标') ? 'monospace' : 'inherit' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={styles.addressDivider} />
            <div style={styles.vitalLabel}>{text('区域')}</div>
            <div style={styles.vitalValue}>{locationLabel}</div>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionKicker}>DOCKING · {text('泊靠条件')}</div>
            {renderDetailList([
              [text('船长限制'), poi.maxLength ? `${poi.maxLength} m` : text('未标注')],
              [text('海床'), seabedLabels.join(' / ') || text('未标注')],
              [text('遮蔽'), poi.protections.join(' / ') || text('未标注')],
              [text('类型'), poi.type || categoryLabel(poi.category)],
            ])}
          </div>

          {renderAmenityModule([
            { label: text('可预订'), value: poi.bookable ? '✓' : '✗' },
            { label: text('双体友好'), value: poi.multihullFriendly ? '✓' : '—' },
            { label: text('海床'), value: seabedLabels[0] ?? '—' },
            { label: text('遮蔽'), value: poi.protections[0] ?? '—' },
            { label: text('泊位'), value: mooringLabels[0] ?? '—' },
            { label: text('来源'), value: poi.sourceUrl ? 'LINK' : '—' },
          ])}

          {renderTagModule(commonTags)}
          {renderSourceModule(poi)}
        </div>
      )
    }

    return null
  }

  return (
    <div style={styles.page}>
      <div style={styles.top}>
        <div ref={searchWrapRef} style={styles.searchCard}>
          <div style={styles.searchRow}>
            <input
              value={searchDraft}
              onFocus={() => setSearchActive(true)}
              onClick={() => setSearchActive(true)}
              onChange={(event: any) => setSearchDraft(event?.target?.value ?? '')}
              placeholder='Search...'
              style={styles.input}
            />
            <button
              aria-label={text('搜索')}
              style={styles.btn}
              onMouseDown={(event: any) => event.preventDefault?.()}
              onClick={() => applySearch(searchDraft)}
            >
              <svg width='24' height='24' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                <circle cx='11' cy='11' r='6.5' stroke='currentColor' strokeWidth='1.8' />
                <path d='M16 16L21 21' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
              </svg>
            </button>
          </div>
          {searchActive ? (
            <div style={styles.searchPanel}>
              <div style={styles.searchSection}>
                <div style={styles.searchSectionHeader}>
                  <div style={styles.searchSectionTitle}>{text('历史搜索')}</div>
                  {recentSearches.length ? (
                    <button
                      style={styles.sectionAction}
                      onMouseDown={(event: any) => event.preventDefault?.()}
                      onClick={clearRecentSearches}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                {recentSearches.length ? (
                  <div style={styles.recentTags}>
                    {recentSearches.map((item) => (
                      <div
                        key={item}
                        style={styles.recentTag}
                      >
                        <button
                          style={{ border: 'none', background: 'transparent', padding: 0, margin: 0, cursor: 'pointer' }}
                          onMouseDown={(event: any) => event.preventDefault?.()}
                          onClick={() => applySearch(item)}
                        >
                          <span style={styles.recentTagLabel}>{item}</span>
                        </button>
                        <button
                          aria-label={text('删除 {item}', { item })}
                          style={styles.recentTagRemove}
                          onMouseDown={(event: any) => event.preventDefault?.()}
                          onClick={(event: any) => {
                            event.stopPropagation?.()
                            removeRecentSearch(item)
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ ...styles.searchSectionTitle, textTransform: 'none', letterSpacing: '0', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
                    {text('暂无历史搜索')}
                  </div>
                )}
              </div>

              <div style={styles.searchSection}>
                <div style={styles.searchSectionTitle}>{text('常用标签')}</div>
                <div style={styles.chipsRow}>
                  {COMMON_TAGS.map((item) => (
                    <button
                      key={item}
                      style={styles.filterChip}
                      onMouseDown={(event: any) => event.preventDefault?.()}
                      onClick={() => applySearch(item)}
                    >
                      #{text(item)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.searchSection}>
                <div style={styles.searchSectionTitle}>{text('类型')}</div>
                <div style={styles.chipsRow}>
                  {POI_TYPES.map((item) => (
                    <button
                      key={item.id}
                      style={{
                        ...styles.filterChip,
                        background: filter === item.id ? `${item.color ?? '#0ea5e9'}22` : 'rgba(255,255,255,0.78)',
                        borderColor: filter === item.id ? `${item.color ?? '#0ea5e9'}55` : 'rgba(226,232,240,0.95)',
                        color: filter === item.id ? (item.color ?? '#0ea5e9') : '#64748b',
                      }}
                      onMouseDown={(event: any) => event.preventDefault?.()}
                      onClick={() => applyType(item.id)}
                    >
                      {text(item.label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={styles.mapWrap}>
        <div ref={mapRef} style={styles.map} />

        <button
          aria-label={text('切换地图显示方式')}
          style={styles.mapStyleBtn}
          onClick={() => setMapStyle((current) => current === 'standard' ? 'satellite' : 'standard')}
        >
          <svg width='22' height='22' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
            <path d='M3 7.5L8.5 4.5L15.5 7.5L21 4.5V16.5L15.5 19.5L8.5 16.5L3 19.5V7.5Z' stroke='currentColor' strokeWidth='1.6' strokeLinejoin='round' />
            <path d='M8.5 4.5V16.5' stroke='currentColor' strokeWidth='1.6' />
            <path d='M15.5 7.5V19.5' stroke='currentColor' strokeWidth='1.6' />
          </svg>
        </button>

        {status === 'error' ? (
          <div style={styles.error}>{text('地图脚本加载失败，请刷新后重试。')}</div>
        ) : null}
      </div>

      <div style={styles.bottomNav}>
        {bottomNav.map((item, index) => (
          <button
            key={item.key}
            style={{ ...styles.navItem, borderRight: index === bottomNav.length - 1 ? 0 : styles.navItem.borderRight }}
            onClick={() => router.push(item.href as never)}
          >
            <span style={styles.navIcon}>{glyphForNav(item.icon)}</span>
            <span style={styles.navText}>{item.label}</span>
          </button>
        ))}
      </div>

      {selectedPoi ? (
        <div
          style={styles.modalBackdrop}
          onClick={() => {
            setSelectedPoi(null)
          }}
        >
          <div
            style={styles.modalCard}
            onClick={(event: any) => event.stopPropagation?.()}
          >
            <div style={styles.hero}>
              {selectedPoi.picture ? (
                <img src={selectedPoi.picture} alt={selectedPoi.name} style={styles.heroImage} />
              ) : (
                <div style={styles.heroFallback}>{categoryLabel(selectedPoi.category).slice(0, 1)}</div>
              )}
              <div style={styles.heroOverlay} />
              <div style={styles.modalTopBar}>
                <div style={{
                  ...styles.modalType,
                  color: colorForCategory(selectedPoi.category),
                  background: `${colorForCategory(selectedPoi.category)}20`,
                  border: `1px solid ${colorForCategory(selectedPoi.category)}35`,
                }}>{categoryLabel(selectedPoi.category)}</div>
                <div style={styles.modalTopActions}>
                  <button
                    style={styles.modalGhostBtn}
                    onClick={() => toggleSavedPoi(selectedPoi.id)}
                  >
                    {savedPoiIds.includes(selectedPoi.id) ? '★' : '☆'}
                  </button>
                  <button style={styles.modalGhostBtn}>↗</button>
                  <button
                    style={styles.modalCloseBtn}
                    onClick={() => {
                      setSelectedPoi(null)
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div style={styles.heroInfo}>
                <div style={styles.heroTitle}>{selectedPoi.name}</div>
                <div style={styles.heroMeta}>{categoryLabel(selectedPoi.category)} · ★ {selectedPoi.rating?.toFixed(1) ?? '—'} · {text('{count}评', { count: selectedPoi.commentsCount })}</div>
                <div style={styles.heroSummary}>{shortInfoOf(selectedPoi, text)}</div>
              </div>
            </div>

            <div style={styles.panelScroll}>
              <div style={styles.detailContent}>
                <div style={styles.quickActions}>
                  <button style={styles.iconAction}>☎</button>
                  <button style={styles.iconAction}>⌕</button>
                </div>

                <div style={styles.tabsRow}>
                  {(['详情', '评价', '照片'] as const).map((tab) => {
                    const active = detailTab === tab
                    return (
                      <button
                        key={tab}
                        style={{ ...styles.tabBtn, color: active ? t.text : t.textDim, fontWeight: active ? 600 : 500 }}
                        onClick={() => setDetailTab(tab)}
                      >
                        {text(tab)}
                        {active ? <div style={styles.activeTabLine} /> : null}
                      </button>
                    )
                  })}
                </div>

                {detailTab === '详情' ? (
                  renderDetailModules(selectedPoi)
                ) : null}

                {detailTab === '评价' ? (
                  <div style={styles.sectionCard}>
                    <div style={styles.sectionKicker}>REVIEWS · {text('评价')}</div>
                    <div style={styles.reviewList}>
                      {[
                        { who: 'Sailor Qiqi', stars: 5, text: text('泊位干净，进港指引很稳，夜里靠泊也不会手忙脚乱。') },
                        { who: 'Nina', stars: 5, text: text('海面相对平顺，补给和洗浴条件都比预期好。') },
                        { who: 'Gear Sailor', stars: 4, text: text('信号一般，建议提前准备离线资料，不过整体体验不错。') },
                      ].map((review) => (
                        <div key={review.who} style={styles.reviewItem}>
                          <div style={styles.reviewName}>{review.who}</div>
                          <div style={styles.reviewStars}>{'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}</div>
                          <div style={styles.reviewText}>{review.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {detailTab === '照片' ? (
                  <div style={styles.sectionCard}>
                    <div style={styles.sectionKicker}>PHOTOS · {text('照片')}</div>
                    <div style={styles.photosGrid}>
                      {(selectedPoi.photos.length ? selectedPoi.photos : [selectedPoi.picture].filter(Boolean)).slice(0, 6).map((photo, index) => (
                        <div key={`${photo}-${index}`} style={styles.photoTile}>
                          <img src={photo!} alt={`${selectedPoi.name}-${index + 1}`} style={styles.photoTileImg} />
                        </div>
                      ))}
                      {!selectedPoi.photos.length && !selectedPoi.picture ? (
                        Array.from({ length: 6 }).map((_, index) => (
                          <div key={index} style={styles.photoTile} />
                        ))
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function glyphForNav(icon: string) {
  if (icon === 'home') return '⌂'
  if (icon === 'map') return '⌖'
  if (icon === 'book') return '▤'
  if (icon === 'user') return '◎'
  if (icon === 'route') return '◢'
  return icon.slice(0, 1).toUpperCase()
}
