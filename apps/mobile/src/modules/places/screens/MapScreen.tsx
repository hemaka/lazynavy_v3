import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import MapView, { Callout, Marker, PROVIDER_GOOGLE, type MapType, type Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { POI, PoiCategory, PoiRegionSummary } from '@lazynavy-v3/types'
import { listPoisApi, listPoiSummariesApi } from '../api/client'
import { poiStore } from '../offline/poiStore'
import { colorForCategory, iconForPoi, labelForCategory, POI_TYPES, shortInfoOf } from '../utils/present'
import { useTheme } from '../../../theme'
import { useI18n } from '../../../i18n'

const DEFAULT_REGION: Region = {
  latitude: 38.463,
  longitude: 14.9672,
  latitudeDelta: 8,
  longitudeDelta: 8,
}

const SUMMARY_ZOOM = 4
const DETAIL_ZOOM = 9
const VIEWPORT_MOVE_THRESHOLD = 0.35
const FETCH_DEBOUNCE_MS = 450

type DataMode = 'none' | 'summary' | 'detail'

type FetchSnapshot = {
  region: Region
  zoom: number
  mode: DataMode
  filter: PoiCategory | 'all'
  query: string
}

function bboxForRegion(region: Region) {
  return {
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLng: region.longitude - region.longitudeDelta / 2,
    maxLng: region.longitude + region.longitudeDelta / 2,
  }
}

function bufferedBBoxForRegion(region: Region, factor = 0.5) {
  const bbox = bboxForRegion(region)
  const dLat = (bbox.maxLat - bbox.minLat) * factor
  const dLng = (bbox.maxLng - bbox.minLng) * factor
  return {
    minLat: bbox.minLat - dLat,
    maxLat: bbox.maxLat + dLat,
    minLng: bbox.minLng - dLng,
    maxLng: bbox.maxLng + dLng,
  }
}

function zoomFromRegion(region: Region) {
  const longitudeDelta = Math.max(region.longitudeDelta, 0.0001)
  return Math.max(1, Math.min(18, Math.round(Math.log2(360 / longitudeDelta))))
}

function zoomRegion(region: Region, levels: number): Region {
  const factor = Math.pow(2, levels)
  return {
    latitude: region.latitude,
    longitude: region.longitude,
    latitudeDelta: Math.max(region.latitudeDelta / factor, 0.03),
    longitudeDelta: Math.max(region.longitudeDelta / factor, 0.03),
  }
}

function summaryRegion(summary: PoiRegionSummary, current: Region): Region {
  return zoomRegion({
    ...current,
    latitude: summary.location.lat,
    longitude: summary.location.lng,
  }, 2)
}

function modeForZoom(zoom: number): DataMode {
  if (zoom >= DETAIL_ZOOM) return 'detail'
  if (zoom >= SUMMARY_ZOOM) return 'summary'
  return 'none'
}

function summaryCellSizeForZoom(zoom: number) {
  if (zoom >= 8) return 0.25
  if (zoom >= 7) return 0.45
  if (zoom >= 6) return 0.75
  if (zoom >= 5) return 1.2
  return 2.2
}

function summariesFromPois(items: POI[], zoom: number): PoiRegionSummary[] {
  const cellSize = summaryCellSizeForZoom(zoom)
  const groups = new Map<string, {
    latSum: number
    lngSum: number
    count: number
    categories: Partial<Record<PoiCategory, number>>
    region?: string
  }>()

  for (const poi of items) {
    const latCell = Math.floor(poi.location.lat / cellSize)
    const lngCell = Math.floor(poi.location.lng / cellSize)
    const id = `${latCell}:${lngCell}`
    const current = groups.get(id) ?? {
      latSum: 0,
      lngSum: 0,
      count: 0,
      categories: {},
      region: poi.region ?? poi.country,
    }
    current.latSum += poi.location.lat
    current.lngSum += poi.location.lng
    current.count += 1
    current.categories[poi.category] = (current.categories[poi.category] ?? 0) + 1
    groups.set(id, current)
  }

  return Array.from(groups.entries()).map(([id, group]) => {
    let topCategory: PoiCategory = 'other'
    let topCount = 0
    for (const [category, count] of Object.entries(group.categories) as [PoiCategory, number][]) {
      if (count > topCount) {
        topCategory = category
        topCount = count
      }
    }
    return {
      id: `local:${id}`,
      location: {
        lat: group.latSum / group.count,
        lng: group.lngSum / group.count,
      },
      count: group.count,
      topCategory,
      categories: group.categories,
      region: group.region,
    }
  })
}

function filterPoisInBBox(items: POI[], bbox: ReturnType<typeof bboxForRegion>, category: PoiCategory | 'all') {
  return items.filter((poi) => (
    poi.location.lat >= bbox.minLat
    && poi.location.lat <= bbox.maxLat
    && poi.location.lng >= bbox.minLng
    && poi.location.lng <= bbox.maxLng
    && (category === 'all' || poi.category === category || poi.subtype === category)
  ))
}

function hasMovedEnough(previous: Region, next: Region) {
  const latMoved = Math.abs(previous.latitude - next.latitude)
  const lngMoved = Math.abs(previous.longitude - next.longitude)
  return (
    latMoved > next.latitudeDelta * VIEWPORT_MOVE_THRESHOLD ||
    lngMoved > next.longitudeDelta * VIEWPORT_MOVE_THRESHOLD
  )
}

export default function MapScreen() {
  const t = useTheme()
  const { text } = useI18n()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const mapRef = useRef<MapView | null>(null)
  const requestSeqRef = useRef(0)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchRef = useRef<FetchSnapshot | null>(null)
  const [region, setRegion] = useState(DEFAULT_REGION)
  const [mapType, setMapType] = useState<MapType>('standard')
  const [filter, setFilter] = useState<PoiCategory | 'all'>('all')
  const [queryDraft, setQueryDraft] = useState('')
  const [query, setQuery] = useState('')
  const [summaries, setSummaries] = useState<PoiRegionSummary[]>([])
  const [pois, setPois] = useState<POI[]>([])
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataMode, setDataMode] = useState<DataMode>('none')
  const [offlineMode, setOfflineMode] = useState(false)

  const zoom = zoomFromRegion(region)
  const viewportMode = modeForZoom(zoom)
  const displayedCount = dataMode === 'detail' ? pois.length : summaries.length

  const s = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg, overflow: 'hidden' },
    map: { ...StyleSheet.absoluteFillObject },
    topOverlay: {
      position: 'absolute',
      top: insets.top + 10,
      left: 14,
      right: 14,
      gap: 10,
    },
    searchRow: {
      height: 54,
      borderRadius: 27,
      backgroundColor: 'rgba(255,255,255,0.94)',
      borderWidth: 0.5,
      borderColor: 'rgba(148,163,184,0.24)',
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 22,
      elevation: 6,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 18,
      paddingRight: 8,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: '#475569',
      fontSize: 18,
      paddingVertical: 0,
    },
    searchBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBtnText: { color: '#64748b', fontSize: 22, fontWeight: '300' },
    chipRow: { gap: 8, paddingRight: 14 },
    chip: {
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 17,
      backgroundColor: 'rgba(7,29,54,0.82)',
      borderWidth: 0.5,
      borderColor: 'rgba(245,240,232,0.14)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    chipDot: { width: 6, height: 6, borderRadius: 3 },
    chipText: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '700' },
    toolStack: {
      position: 'absolute',
      right: 14,
      top: insets.top + 128,
      gap: 10,
    },
    toolBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.94)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 5,
    },
    toolText: { color: '#334155', fontSize: 17, fontWeight: '700' },
    locateToolText: { color: '#0284c7', fontSize: 18, fontWeight: '800' },
    markerWrap: { alignItems: 'center', justifyContent: 'center' },
    markerBody: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    markerText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    summaryMarker: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 6,
      backgroundColor: '#0ea5e9',
      borderWidth: 1.5,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#0ea5e9',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 4,
    },
    summaryText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    callout: { width: 220, gap: 7 },
    calloutType: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    calloutName: { color: '#0f172a', fontSize: 16, fontWeight: '800', lineHeight: 20 },
    calloutMeta: { color: '#475569', fontSize: 12, lineHeight: 17 },
    calloutBtn: {
      marginTop: 4,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#0ea5e9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    calloutBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    bottomPanel: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 92,
      borderRadius: 22,
      backgroundColor: 'rgba(7,29,54,0.88)',
      borderWidth: 0.5,
      borderColor: 'rgba(245,240,232,0.12)',
      padding: 14,
      gap: 8,
    },
    panelTitle: { color: t.text, fontSize: 14, fontWeight: '800' },
    panelText: { color: t.textDim, fontSize: 12.5, lineHeight: 18 },
    panelAction: {
      alignSelf: 'flex-start',
      height: 34,
      borderRadius: 17,
      paddingHorizontal: 14,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    status: {
      position: 'absolute',
      left: 14,
      bottom: 92,
      maxWidth: 240,
      borderRadius: 18,
      backgroundColor: 'rgba(7,29,54,0.88)',
      borderWidth: 0.5,
      borderColor: 'rgba(245,240,232,0.12)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusText: { color: t.text, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  }), [insets.top, t])

  useEffect(() => {
    scheduleMapDataLoad(region, true)
    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    }
  }, [filter, query])

  function shouldFetch(nextRegion: Region, force = false) {
    if (force) return true
    const previous = lastFetchRef.current
    if (!previous) return true

    const nextZoom = zoomFromRegion(nextRegion)
    const nextMode = modeForZoom(nextZoom)

    if (previous.filter !== filter || previous.query !== query.trim()) return true
    if (previous.mode !== nextMode) return true
    if (previous.zoom !== nextZoom) return true
    return hasMovedEnough(previous.region, nextRegion)
  }

  function scheduleMapDataLoad(nextRegion: Region, force = false) {
    if (!shouldFetch(nextRegion, force)) return
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)

    fetchTimerRef.current = setTimeout(() => {
      void loadMapData(nextRegion, force)
    }, force ? 0 : FETCH_DEBOUNCE_MS)
  }

  function cacheServerPois(items: POI[], targetRegion: Region) {
    const nearBbox = bufferedBBoxForRegion(targetRegion)
    const fresh = filterPoisInBBox(items, nearBbox, filter)
    void poiStore.syncFromServerList(fresh).catch(() => undefined)
    return fresh
  }

  async function loadMapData(targetRegion: Region, force = false) {
    if (!shouldFetch(targetRegion, force)) return

    const requestId = requestSeqRef.current + 1
    requestSeqRef.current = requestId
    const targetZoom = zoomFromRegion(targetRegion)
    const hasQuery = !!query.trim()
    // 有搜索词时强制 detail 模式:走 /pois?q=(按名称/地区匹配),否则缩放较小时会落到
    // 区域汇总(summary)分支,q 不参与汇总 → 表现为「搜索不生效」。
    const targetMode = hasQuery ? 'detail' : modeForZoom(targetZoom)
    const hasExistingData = dataMode !== 'none' && (pois.length > 0 || summaries.length > 0)

    lastFetchRef.current = {
      region: targetRegion,
      zoom: targetZoom,
      mode: targetMode,
      filter,
      query: query.trim(),
    }
    setLoading(!hasExistingData)
    setRefreshing(hasExistingData)
    setError(null)
    try {
      const filters = {
        category: filter,
        q: query.trim() || undefined,
        lat: targetRegion.latitude,
        lng: targetRegion.longitude,
        zoom: targetZoom,
        limit: 220,
      }
      if (targetMode === 'detail') {
        const next = await listPoisApi(filters)
        if (requestSeqRef.current !== requestId) return

        // 搜索态:直接展示匹配结果(可在视野外),不按视野 bbox 裁剪,否则搜到的远处地标会被过滤掉。
        if (hasQuery) {
          void poiStore.syncFromServerList(next).catch(() => undefined)
          setPois(next.slice(0, 600))
          setSummaries([])
          setDataMode('detail')
          setOfflineMode(false)
          return
        }

        // Filter server response to a buffer around the current viewport so
        // the server's fallback-by-rating (worldwide) response doesn't pollute
        // the map with distant markers.
        const nearBbox = bufferedBBoxForRegion(targetRegion)
        const fresh = cacheServerPois(next, targetRegion)

        // Merge with existing markers (within the same buffer) so panning /
        // zooming a little doesn't drop POIs we already showed. This avoids
        // the "markers disappear when I move slightly" feeling.
        const MAX_MARKERS = 600
        setPois((prev) => {
          const byId = new Map<string, typeof prev[number]>()
          for (const p of prev) {
            if (
              p.location.lat >= nearBbox.minLat && p.location.lat <= nearBbox.maxLat
              && p.location.lng >= nearBbox.minLng && p.location.lng <= nearBbox.maxLng
            ) {
              byId.set(p.id, p)
            }
          }
          for (const p of fresh) byId.set(p.id, p) // newer version wins
          const merged = Array.from(byId.values())
          // Cap to keep marker count bounded; drop the farthest from center.
          if (merged.length <= MAX_MARKERS) return merged
          const cx = targetRegion.latitude
          const cy = targetRegion.longitude
          merged.sort((a, b) => {
            const da = (a.location.lat - cx) ** 2 + (a.location.lng - cy) ** 2
            const db = (b.location.lat - cx) ** 2 + (b.location.lng - cy) ** 2
            return da - db
          })
          return merged.slice(0, MAX_MARKERS)
        })
        setSummaries([])
        setDataMode('detail')
        setOfflineMode(false)
        if (selectedPoi && !fresh.some((poi) => poi.id === selectedPoi.id)) {
          // Only clear selected when the server explicitly didn't include it
          // and we're not currently showing it from cache. We leave it for now;
          // a stale selected POI just means the side panel still references it.
        }
      } else if (targetMode === 'summary') {
        const next = await listPoiSummariesApi(filters)
        if (requestSeqRef.current !== requestId) return
        void listPoisApi(filters)
          .then((items) => cacheServerPois(items, targetRegion))
          .catch(() => undefined)
        if (next.length > 0) {
          setSummaries(next)
          // Only clear detail markers when actually switching modes.
          if (dataMode !== 'summary') {
            setPois([])
            setSelectedPoi(null)
          }
          setDataMode('summary')
          setOfflineMode(false)
        } else {
          setDataMode('summary')
          setOfflineMode(false)
        }
      } else {
        if (requestSeqRef.current !== requestId) return
        // 'none' = too zoomed out; only clear if we're actually changing modes.
        if (dataMode !== 'none') {
          setSummaries([])
          setPois([])
          setSelectedPoi(null)
        }
        setDataMode('none')
        setOfflineMode(false)
      }
    } catch {
      if (requestSeqRef.current !== requestId) return
      lastFetchRef.current = null
      await loadCachedMapData(targetRegion, targetZoom, targetMode, requestId)
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  async function queryCachedPois(targetRegion: Region, targetMode: DataMode) {
    const trimmedQuery = query.trim()
    const bbox = bufferedBBoxForRegion(targetRegion, targetMode === 'summary' ? 0.75 : 0.5)

    if (trimmedQuery) {
      const searchResults = await poiStore.search(trimmedQuery, { limit: targetMode === 'summary' ? 1200 : 350 })
      return filterPoisInBBox(searchResults, bbox, filter)
    }

    return poiStore.queryByBBox({
      ...bbox,
      category: filter,
      limit: targetMode === 'summary' ? 1200 : 600,
    })
  }

  async function loadCachedMapData(targetRegion: Region, targetZoom: number, targetMode: DataMode, requestId: number) {
    try {
      if (targetMode === 'detail') {
        const cached = await queryCachedPois(targetRegion, targetMode)
        if (requestSeqRef.current !== requestId) return
        setPois(cached)
        setSummaries([])
        setSelectedPoi((current) => current && cached.some((poi) => poi.id === current.id) ? current : null)
        setDataMode('detail')
        setOfflineMode(true)
        setError(cached.length > 0 ? null : text('当前视野没有本地缓存地标'))
        return
      }

      if (targetMode === 'summary') {
        const cached = await queryCachedPois(targetRegion, targetMode)
        const localSummaries = summariesFromPois(cached, targetZoom)
        if (requestSeqRef.current !== requestId) return
        setSummaries(localSummaries)
        setPois([])
        setSelectedPoi(null)
        setDataMode('summary')
        setOfflineMode(true)
        setError(localSummaries.length > 0 ? null : text('当前视野没有本地缓存地标'))
        return
      }

      setSummaries([])
      setPois([])
      setSelectedPoi(null)
      setDataMode('none')
      setOfflineMode(true)
      setError(text('请放大地图查看本地缓存地标'))
    } catch (cacheErr: any) {
      if (requestSeqRef.current !== requestId) return
      setError(cacheErr?.message ?? text('地图地标加载失败'))
    }
  }

  function applySearch() {
    setQuery(queryDraft.trim())
  }

  function recenter() {
    mapRef.current?.animateToRegion(DEFAULT_REGION, 350)
    scheduleMapDataLoad(DEFAULT_REGION, true)
  }

  function zoomIntoSummary(summary: PoiRegionSummary) {
    mapRef.current?.animateToRegion(summaryRegion(summary, region), 360)
  }

  function openPoi(poi: POI) {
    router.push(`/poi/${poi.id}`)
  }

  function renderStatusText() {
    if (loading) return text('正在加载地标...')
    if (error) return error
    if (offlineMode) {
      if (dataMode === 'summary') return `${text('本地缓存')} · ${displayedCount} ${text('个区域')} · ${text('放大查看地标')}`
      if (dataMode === 'detail') return `${text('本地缓存')} · ${displayedCount} ${text('个地标')}`
      return `${text('本地缓存')} · ${text('放大查看地标')}`
    }
    if (refreshing) return text('正在刷新地标...')
    if (dataMode === 'summary') return `${displayedCount} ${text('个区域')} · ${text('放大查看地标')}`
    if (dataMode === 'detail') return `${displayedCount} ${text('个地标')}`
    return text('放大查看地标')
  }

  return (
    <View style={s.screen}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      <MapView
        ref={mapRef}
        style={s.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={DEFAULT_REGION}
        mapType={mapType}
        rotateEnabled={false}
        showsCompass={false}
        showsScale
        onRegionChangeComplete={(nextRegion) => {
          setRegion(nextRegion)
          scheduleMapDataLoad(nextRegion)
        }}
        onPress={() => setSelectedPoi(null)}
      >
        {dataMode === 'summary' ? summaries.map((summary) => (
          <Marker
            key={summary.id}
            coordinate={{
              latitude: summary.location.lat,
              longitude: summary.location.lng,
            }}
            tracksViewChanges={false}
            onPress={() => zoomIntoSummary(summary)}
          >
            <View style={s.summaryMarker}>
              <Text style={s.summaryText}>{summary.count}</Text>
            </View>
          </Marker>
        )) : null}

        {dataMode === 'detail' ? pois.map((poi) => {
          const color = colorForCategory(poi.category)
          return (
            <Marker
              key={poi.id}
              coordinate={{
                latitude: poi.location.lat,
                longitude: poi.location.lng,
              }}
              tracksViewChanges={false}
              onPress={() => setSelectedPoi(poi)}
              onCalloutPress={() => openPoi(poi)}
            >
              <View style={s.markerWrap}>
                <View style={[s.markerBody, { backgroundColor: color }]}>
                  <Text style={s.markerText}>{iconForPoi(poi)}</Text>
                </View>
              </View>
              <Callout tooltip={false}>
                <View style={s.callout}>
                  <Text style={[s.calloutType, { color }]}>{labelForCategory(poi.category, text).toUpperCase()}</Text>
                  <Text style={s.calloutName}>{poi.name}</Text>
                  <Text style={s.calloutMeta}>{shortInfoOf(poi, text)}</Text>
                  <TouchableOpacity style={s.calloutBtn} onPress={() => openPoi(poi)}>
                    <Text style={s.calloutBtnText}>{text('查看详情')}</Text>
                  </TouchableOpacity>
                </View>
              </Callout>
            </Marker>
          )
        }) : null}
      </MapView>

      <View style={s.topOverlay} pointerEvents="box-none">
        <View style={s.searchRow}>
          <TextInput
            value={queryDraft}
            onChangeText={setQueryDraft}
            placeholder="Search..."
            placeholderTextColor="rgba(100,116,139,0.54)"
            returnKeyType="search"
            style={s.searchInput}
            onSubmitEditing={applySearch}
          />
          <TouchableOpacity style={s.searchBtn} onPress={applySearch}>
            <Text style={s.searchBtnText}>⌕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {POI_TYPES.map((type) => {
            const active = filter === type.id
            const color = type.color ?? t.accent
            return (
              <TouchableOpacity
                key={type.id}
                style={[s.chip, active && { backgroundColor: `${color}dd`, borderColor: 'rgba(255,255,255,0.28)' }]}
                onPress={() => setFilter(type.id)}
              >
                <View style={[s.chipDot, { backgroundColor: active ? '#fff' : color }]} />
                <Text style={[s.chipText, active && { color: '#fff' }]}>{text(type.label)}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      <View style={s.toolStack}>
        <TouchableOpacity style={s.toolBtn} onPress={() => setMapType((current) => current === 'standard' ? 'satellite' : 'standard')}>
          <Text style={s.toolText}>◐</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.toolBtn} onPress={recenter}>
          <Text style={s.locateToolText}>◎</Text>
        </TouchableOpacity>
      </View>

      {selectedPoi ? (
        <View style={s.bottomPanel}>
          <Text style={s.panelTitle}>{selectedPoi.name}</Text>
          <Text style={s.panelText}>{labelForCategory(selectedPoi.category, text)} · {shortInfoOf(selectedPoi, text)}</Text>
          <TouchableOpacity style={s.panelAction} onPress={() => openPoi(selectedPoi)}>
            <Text style={s.panelActionText}>{text('打开详情')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.status}>
          {loading || refreshing ? <ActivityIndicator size="small" color={t.text} /> : null}
          <Text style={s.statusText}>{renderStatusText()}</Text>
        </View>
      )}
    </View>
  )
}
