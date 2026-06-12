import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import MapView, { Marker, PROVIDER_GOOGLE, type MapType, type Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { POI, PoiCategory, PoiNote, PoiRegionSummary, PoiReview } from '@lazynavy-v3/types'
import { addPoiNoteApi, deletePoiNoteApi, getMyPoiReviewApi, getPoiApi, listPoiNotesApi, listPoiReviewsApi, listPoisApi, listPoiSummariesApi, upsertPoiReviewApi } from '../api/client'
import { poiStore } from '../offline/poiStore'
import { colorForCategory, coordinateLabel, iconForPoi, labelForCategory, localizeProtection, POI_TYPES, shortInfoOf } from '../utils/present'
import { useAuth } from '../../identity/public'
import { useTheme } from '../../../theme'
import { useI18n } from '../../../i18n'
import { useBottomNavTransition } from '../../../navigation/bottomNavTransition'

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

const PROTECTION_DIRECTIONS = [
  { key: 'n', short: 'N', label: '北', x: 85, y: 8 },
  { key: 'ne', short: 'NE', label: '东北', x: 145, y: 28 },
  { key: 'e', short: 'E', label: '东', x: 164, y: 88 },
  { key: 'se', short: 'SE', label: '东南', x: 145, y: 148 },
  { key: 's', short: 'S', label: '南', x: 85, y: 168 },
  { key: 'sw', short: 'SW', label: '西南', x: 25, y: 148 },
  { key: 'w', short: 'W', label: '西', x: 6, y: 88 },
  { key: 'nw', short: 'NW', label: '西北', x: 25, y: 28 },
] as const

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export default function MapScreen() {
  const t = useTheme()
  const { text } = useI18n()
  const { token, user } = useAuth()
  const { setBottomNavHidden } = useBottomNavTransition()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const mapRef = useRef<MapView | null>(null)
  const requestSeqRef = useRef(0)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchRef = useRef<FetchSnapshot | null>(null)
  const detailLoadRef = useRef<string | null>(null)
  const suppressNextMapPressRef = useRef(false)
  const sheetDismissingRef = useRef(false)
  const sheetTranslateY = useRef(new Animated.Value(windowHeight)).current
  const sheetOffsetRef = useRef(windowHeight)
  const [region, setRegion] = useState(DEFAULT_REGION)
  const [mapType, setMapType] = useState<MapType>('standard')
  const [filter, setFilter] = useState<PoiCategory | 'all'>('all')
  const [queryDraft, setQueryDraft] = useState('')
  const [query, setQuery] = useState('')
  const [summaries, setSummaries] = useState<PoiRegionSummary[]>([])
  const [pois, setPois] = useState<POI[]>([])
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null)
  const [sheetDetailPoi, setSheetDetailPoi] = useState<POI | null>(null)
  const [sheetDetailLoading, setSheetDetailLoading] = useState(false)
  const [sheetDetailError, setSheetDetailError] = useState<string | null>(null)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [detailTab, setDetailTab] = useState<'详情' | '评价' | '照片'>('详情')
  const [poiNotes, setPoiNotes] = useState<PoiNote[]>([])
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<'info' | 'warning'>('info')
  const [addingNote, setAddingNote] = useState(false)
  const [submittingNote, setSubmittingNote] = useState(false)
  const [poiReviews, setPoiReviews] = useState<PoiReview[]>([])
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const [, setLoading] = useState(true)
  const [, setRefreshing] = useState(false)
  const [, setError] = useState<string | null>(null)
  const [dataMode, setDataMode] = useState<DataMode>('none')
  const [, setOfflineMode] = useState(false)

  const zoom = zoomFromRegion(region)
  const viewportMode = modeForZoom(zoom)
  const sheetHeight = windowHeight
  const collapsedSheetHeight = Math.min(Math.max(windowHeight / 3, 260), sheetHeight - 84)
  const collapsedSheetOffset = sheetHeight - collapsedSheetHeight
  const hiddenSheetOffset = sheetHeight + insets.bottom + 24

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
    poiSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: sheetHeight,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: t.surface,
      borderWidth: 0.5,
      borderColor: t.border,
      borderBottomWidth: 0,
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 12,
      overflow: 'hidden',
    },
    poiSheetFull: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderWidth: 0,
      shadowOpacity: 0,
      backgroundColor: '#f6f4ef',
    },
    sheetNav: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 14,
      paddingBottom: 8,
      minHeight: insets.top + 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: t.border,
      backgroundColor: t.surface,
    },
    sheetNavButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceAlt,
      borderWidth: 0.5,
      borderColor: t.border,
    },
    sheetNavButtonText: { color: t.text, fontSize: 22, fontWeight: '800', lineHeight: 24 },
    sheetNavCenter: { flex: 1 },
    sheetNavTitle: { color: t.text, fontSize: 16, fontWeight: '900' },
    sheetNavMeta: { color: t.textDim, fontSize: 11.5, marginTop: 2 },
    sheetHandleZone: {
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetHandle: {
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: t.textSoft,
      opacity: 0.65,
    },
    sheetContent: {
      paddingHorizontal: 18,
      paddingBottom: insets.bottom + 32,
      gap: 14,
    },
    sheetContentFull: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: insets.bottom + 44,
      gap: 0,
      backgroundColor: '#f6f4ef',
    },
    sheetHeader: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    sheetIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 2,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 4,
    },
    sheetIconText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    sheetHeaderText: {
      flex: 1,
      gap: 8,
    },
    sheetKicker: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
    panelTitle: { color: t.text, fontSize: 20, fontWeight: '900', lineHeight: 25 },
    panelText: { color: t.textDim, fontSize: 13, lineHeight: 19 },
    sheetClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetCloseText: { color: t.textDim, fontSize: 18, fontWeight: '800' },
    sheetStats: {
      flexDirection: 'row',
      gap: 10,
    },
    sheetStat: {
      flex: 1,
      minHeight: 70,
      borderRadius: 14,
      backgroundColor: t.surfaceAlt,
      borderWidth: 0.5,
      borderColor: t.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 5,
    },
    sheetStatLabel: { color: t.textSoft, fontSize: 10, fontWeight: '900' },
    sheetStatValue: { color: t.text, fontSize: 14, fontWeight: '800' },
    detailHero: {
      minHeight: 312,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      paddingHorizontal: 18,
      paddingBottom: 18,
      backgroundColor: '#102a4f',
    },
    detailPhotoBase: {
      ...StyleSheet.absoluteFillObject,
    },
    detailPhotoStripeLayer: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.28,
    },
    detailPhotoStripe: {
      position: 'absolute',
      width: 1,
      height: 520,
      backgroundColor: 'rgba(255,255,255,0.10)',
      transform: [{ rotate: '45deg' }],
    },
    detailPhotoHorizon: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '58%',
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    detailPhotoLabel: {
      position: 'absolute',
      left: 12,
      bottom: 10,
      color: 'rgba(255,255,255,0.65)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    detailHeroFadeTop: {
      ...StyleSheet.absoluteFillObject,
      height: 128,
    },
    detailHeroFadeBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 144,
    },
    heroChrome: {
      position: 'absolute',
      top: insets.top + 10,
      left: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroChromeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroChromeBtnText: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 26 },
    heroStatusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatusText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
    },
    heroRightActions: { flexDirection: 'row', gap: 8 },
    detailHeroTop: {
      gap: 6,
    },
    detailHeroPillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    detailHeroTypePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    detailHeroTypeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    detailHeroStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    detailHeroStatusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4ade80' },
    detailHeroStatusText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    detailHeroTitle: { color: '#fff', fontSize: 25, lineHeight: 31, fontWeight: '900' },
    detailHeroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
    detailHeroMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
    detailHeroMetaDot: { color: 'rgba(255,255,255,0.52)', fontSize: 12 },
    detailBody: {
      paddingHorizontal: 14,
      paddingTop: 12,
      gap: 12,
    },
    quickActionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    quickActionPrimary: {
      flex: 1,
      height: 42,
      borderRadius: 12,
      backgroundColor: '#0284c7',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    quickActionPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    quickActionIconBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: '#fff',
      borderWidth: 0.5,
      borderColor: 'rgba(13,52,96,0.10)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionIconText: { color: '#0d3460', fontSize: 18, fontWeight: '900' },
    detailTabsRow: {
      flexDirection: 'row',
      gap: 18,
      paddingHorizontal: 2,
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(13,52,96,0.10)',
    },
    detailTabBtn: {
      paddingTop: 8,
      paddingBottom: 9,
      position: 'relative',
    },
    detailTabText: { fontSize: 14, fontWeight: '700' },
    detailTabUnderline: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: -1,
      height: 2,
      backgroundColor: '#0284c7',
    },
    noticeStrip: {
      borderRadius: 12,
      backgroundColor: 'rgba(251,146,60,0.10)',
      borderWidth: 0.5,
      borderColor: 'rgba(251,146,60,0.30)',
      padding: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    noticeIcon: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#fb923c',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    noticeIconText: { color: '#fff', fontSize: 11, fontWeight: '900' },
    noticeText: { flex: 1, color: '#b45309', fontSize: 12, lineHeight: 18, fontWeight: '700' },
    cardPad: {
      borderRadius: 16,
      backgroundColor: '#fff',
      borderWidth: 0.5,
      borderColor: 'rgba(13,52,96,0.10)',
      padding: 16,
    },
    sectionKicker: {
      color: 'rgba(13,52,96,0.62)',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.4,
      marginBottom: 12,
    },
    vitalsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 14,
      columnGap: 10,
    },
    vitalCell: { width: '47%' },
    vitalLabel: { color: 'rgba(13,52,96,0.32)', fontSize: 10, fontWeight: '800', marginBottom: 3 },
    vitalValue: { color: '#0d3460', fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
    protectionCompassWrap: {
      marginTop: 16,
      borderRadius: 14,
      backgroundColor: '#f5f8f5',
      borderWidth: 0.5,
      borderColor: 'rgba(5,150,105,0.16)',
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    protectionCompass: {
      width: 198,
      height: 198,
      borderRadius: 99,
      backgroundColor: '#e8f3ed',
      borderWidth: 1,
      borderColor: 'rgba(5,150,105,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    protectionCompassRing: {
      position: 'absolute',
      width: 116,
      height: 116,
      borderRadius: 58,
      borderWidth: 1,
      borderColor: 'rgba(13,52,96,0.10)',
    },
    protectionCompassCrossV: {
      position: 'absolute',
      width: 1,
      height: 154,
      backgroundColor: 'rgba(13,52,96,0.08)',
    },
    protectionCompassCrossH: {
      position: 'absolute',
      height: 1,
      width: 154,
      backgroundColor: 'rgba(13,52,96,0.08)',
    },
    protectionCenter: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: 'rgba(5,150,105,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#0d3460',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    protectionCenterIcon: { color: '#047857', fontSize: 24, fontWeight: '900' },
    protectionDirection: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    protectionDirectionText: { fontSize: 8.5, fontWeight: '900' },
    protectionLegend: { flex: 1, gap: 8 },
    protectionLegendTitle: { color: '#0d3460', fontSize: 13, fontWeight: '900', lineHeight: 18 },
    protectionLegendText: { color: 'rgba(13,52,96,0.58)', fontSize: 12, lineHeight: 18, fontWeight: '700' },
    protectionLegendPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    protectionPill: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(5,150,105,0.10)',
    },
    protectionPillText: { color: '#047857', fontSize: 11, fontWeight: '800' },
    addressDivider: {
      height: 0.5,
      backgroundColor: 'rgba(13,52,96,0.10)',
      marginVertical: 14,
      marginHorizontal: -16,
    },
    amenitiesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    amenityTile: {
      width: '31%',
      minHeight: 58,
      borderRadius: 10,
      backgroundColor: '#f0ece3',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      paddingVertical: 9,
    },
    amenityValue: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
    amenityLabel: { color: 'rgba(13,52,96,0.62)', fontSize: 11, fontWeight: '700', textAlign: 'center' },
    reviewItem: {
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(13,52,96,0.10)',
    },
    reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
    reviewAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#17446f',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reviewAvatarText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    reviewName: { color: '#0d3460', fontSize: 13, fontWeight: '800' },
    reviewStars: { color: '#fbbf24', fontSize: 11, marginTop: 1 },
    reviewText: { color: 'rgba(13,52,96,0.64)', fontSize: 13, lineHeight: 19 },
    emptyText: { color: 'rgba(13,52,96,0.48)', fontSize: 13, lineHeight: 19, fontWeight: '700' },
    noteHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    inlineActionText: { color: '#0284c7', fontSize: 12.5, fontWeight: '900' },
    noteComposer: {
      borderRadius: 14,
      backgroundColor: '#f6f4ef',
      borderWidth: 0.5,
      borderColor: 'rgba(13,52,96,0.10)',
      padding: 12,
      gap: 10,
      marginBottom: 12,
    },
    noteTypeRow: { flexDirection: 'row', gap: 8 },
    noteTypeChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: '#fff',
      borderWidth: 0.5,
      borderColor: 'rgba(13,52,96,0.12)',
    },
    noteTypeChipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
    noteTypeChipWarn: { backgroundColor: '#f97316', borderColor: '#f97316' },
    noteTypeChipText: { color: 'rgba(13,52,96,0.62)', fontSize: 12, fontWeight: '800' },
    noteTypeChipTextActive: { color: '#fff' },
    noteInput: {
      minHeight: 72,
      borderRadius: 12,
      backgroundColor: '#fff',
      borderWidth: 0.5,
      borderColor: 'rgba(13,52,96,0.10)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: '#0d3460',
      fontSize: 13,
      lineHeight: 18,
      textAlignVertical: 'top',
    },
    submitBtn: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      backgroundColor: '#0284c7',
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    submitBtnDisabled: { opacity: 0.48 },
    submitBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '900' },
    noteItem: {
      paddingVertical: 11,
      borderTopWidth: 0.5,
      borderTopColor: 'rgba(13,52,96,0.10)',
      gap: 6,
    },
    noteItemWarn: {
      marginHorizontal: -6,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(249,115,22,0.09)',
      borderTopWidth: 0,
      marginTop: 8,
    },
    noteItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    noteBadge: { color: 'rgba(13,52,96,0.46)', fontSize: 11, fontWeight: '900' },
    noteBadgeWarn: { color: '#c2410c' },
    noteDeleteText: { color: 'rgba(13,52,96,0.46)', fontSize: 12, fontWeight: '800' },
    noteBody: { color: '#0d3460', fontSize: 13, lineHeight: 19, fontWeight: '700' },
    ratingSummary: {
      borderRadius: 14,
      backgroundColor: '#f6f4ef',
      padding: 12,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    ratingBig: { color: '#0d3460', fontSize: 25, lineHeight: 29, fontWeight: '900' },
    ratingCaption: { color: 'rgba(13,52,96,0.48)', fontSize: 12, fontWeight: '800' },
    reviewComposer: {
      borderRadius: 14,
      backgroundColor: '#fffaf0',
      borderWidth: 0.5,
      borderColor: 'rgba(251,191,36,0.26)',
      padding: 12,
      gap: 10,
      marginBottom: 12,
    },
    starRow: { flexDirection: 'row', gap: 4 },
    starBtn: { paddingRight: 4, paddingVertical: 2 },
    starText: { color: 'rgba(13,52,96,0.18)', fontSize: 27, lineHeight: 30, fontWeight: '900' },
    starTextOn: { color: '#f59e0b' },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    photoTile: {
      width: '32%',
      aspectRatio: 1,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#17446f',
    },
    photoTileStripeLayer: { ...StyleSheet.absoluteFillObject, opacity: 0.22 },
    photoTileStripe: {
      position: 'absolute',
      width: 1,
      height: 170,
      backgroundColor: 'rgba(255,255,255,0.14)',
      transform: [{ rotate: '45deg' }],
    },
    photoTileHorizon: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '58%',
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    detailMetricRow: {
      flexDirection: 'row',
      gap: 8,
    },
    detailMetric: {
      flex: 1,
      minHeight: 82,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 8,
      backgroundColor: '#fff',
      borderWidth: 0.5,
      borderColor: 'rgba(13,52,96,0.10)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    detailMetricIcon: { color: '#0284c7', fontSize: 17, fontWeight: '900' },
    detailMetricLabel: { color: 'rgba(13,52,96,0.38)', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
    detailMetricValue: { color: '#0d3460', fontSize: 15, fontWeight: '900', lineHeight: 18, textAlign: 'center' },
    sheetBlock: {
      borderRadius: 16,
      backgroundColor: '#fff',
      borderWidth: 0.5,
      borderColor: 'rgba(13,52,96,0.10)',
      padding: 0,
      overflow: 'hidden',
    },
    sheetBlockPad: { padding: 14, gap: 10 },
    sheetBlockHeader: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetBlockTitle: { color: '#0d3460', fontSize: 15, fontWeight: '900' },
    sheetBlockKicker: { color: 'rgba(13,52,96,0.42)', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
    sheetBlockText: { color: 'rgba(13,52,96,0.64)', fontSize: 13, lineHeight: 20 },
    sheetLoadingText: { color: '#0284c7', fontSize: 13, fontWeight: '800' },
    detailDivider: {
      height: 0.5,
      backgroundColor: 'rgba(13,52,96,0.10)',
      marginLeft: 70,
    },
    detailGrid: { gap: 10 },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 14,
      paddingVertical: 4,
    },
    detailLabel: { color: t.textSoft, fontSize: 12, fontWeight: '800', flex: 1 },
    detailValue: { color: t.text, fontSize: 13, lineHeight: 18, textAlign: 'right', flex: 1.4 },
    infoCluster: {
      gap: 0,
    },
    infoTile: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      backgroundColor: '#fff',
    },
    infoTileIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0ece3',
      color: '#0284c7',
      fontSize: 17,
      fontWeight: '900',
      overflow: 'hidden',
    },
    infoTileBody: { flex: 1, gap: 3 },
    infoTileLabel: { color: 'rgba(13,52,96,0.42)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    infoTileValue: { color: '#0d3460', fontSize: 13.5, lineHeight: 19, fontWeight: '700' },
    noteCard: {
      borderRadius: 16,
      backgroundColor: '#fff',
      borderWidth: 0.5,
      borderColor: 'rgba(13,52,96,0.10)',
      padding: 16,
      gap: 8,
    },
    zoomBadge: {
      position: 'absolute',
      left: 14,
      bottom: 92,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderWidth: 0.5,
      borderColor: 'rgba(148,163,184,0.28)',
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    zoomBadgeText: { color: '#334155', fontSize: 11, fontWeight: '800' },
  }), [insets.bottom, insets.top, sheetHeight, t])

  useEffect(() => {
    scheduleMapDataLoad(region, true)
    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    }
  }, [filter, query])

  useEffect(() => {
    if (selectedPoi) {
      animateSheetTo(collapsedSheetOffset)
    } else {
      sheetTranslateY.setValue(hiddenSheetOffset)
      sheetOffsetRef.current = hiddenSheetOffset
    }
  }, [collapsedSheetOffset, hiddenSheetOffset, selectedPoi?.id])

  useEffect(() => {
    setBottomNavHidden(sheetExpanded)
    return () => setBottomNavHidden(false)
  }, [setBottomNavHidden, sheetExpanded])

  useEffect(() => {
    if (!selectedPoi || !sheetExpanded) return
    void refreshSheetNotes(selectedPoi.id)
    void refreshSheetReviews(selectedPoi.id)
  }, [selectedPoi?.id, sheetExpanded, token])

  const sheetPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
    ),
    onPanResponderGrant: () => {
      sheetTranslateY.stopAnimation((value) => {
        sheetOffsetRef.current = value
      })
    },
    onPanResponderMove: (_, gesture) => {
      const next = clamp(sheetOffsetRef.current + gesture.dy, 0, hiddenSheetOffset)
      sheetTranslateY.setValue(next)
    },
    onPanResponderRelease: (_, gesture) => {
      const next = sheetOffsetRef.current + gesture.dy
      if (gesture.dy > 72 || gesture.vy > 0.75) {
        dismissSheet()
        return
      }
      if (sheetExpanded) {
        animateSheetTo(0)
        return
      }
      if (gesture.dy < -48 || gesture.vy < -0.55 || next < collapsedSheetOffset / 2) {
        if (selectedPoi) expandSheet(selectedPoi)
        return
      }
      animateSheetTo(collapsedSheetOffset)
    },
    onPanResponderTerminate: () => animateSheetTo(sheetExpanded ? 0 : collapsedSheetOffset),
  }), [collapsedSheetOffset, hiddenSheetOffset, selectedPoi, sheetExpanded, sheetTranslateY])

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
        ...(hasQuery ? {} : bufferedBBoxForRegion(targetRegion, targetMode === 'summary' ? 0.75 : 0.5)),
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

  function animateSheetTo(toValue: number, onDone?: () => void) {
    sheetOffsetRef.current = toValue
    Animated.timing(sheetTranslateY, {
      toValue,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone?.()
    })
  }

  function dismissSheet() {
    if (sheetDismissingRef.current) return
    sheetDismissingRef.current = true
    animateSheetTo(hiddenSheetOffset, () => {
      setSelectedPoi(null)
      setSheetDetailPoi(null)
      setSheetDetailError(null)
      setSheetDetailLoading(false)
      setSheetExpanded(false)
      setPoiNotes([])
      setPoiReviews([])
      setMyRating(0)
      setMyComment('')
      setNoteText('')
      setNoteType('info')
      setAddingNote(false)
      sheetDismissingRef.current = false
    })
  }

  function expandSheet(poi: POI) {
    setSheetExpanded(true)
    setDetailTab('详情')
    animateSheetTo(0)
    void loadPoiDetailIntoSheet(poi)
  }

  function collapseSheet() {
    setSheetExpanded(false)
    animateSheetTo(collapsedSheetOffset)
  }

  async function loadPoiDetailIntoSheet(poi: POI) {
    if (sheetDetailPoi?.id === poi.id) return
    if (detailLoadRef.current === poi.id) return
    detailLoadRef.current = poi.id
    setSheetDetailLoading(true)
    setSheetDetailError(null)
    try {
      const detail = await getPoiApi(poi.id)
      setSheetDetailPoi(detail)
      void poiStore.upsertDetail(detail).catch(() => undefined)
    } catch (err: any) {
      setSheetDetailError(err?.message ?? text('详情加载失败'))
    } finally {
      if (detailLoadRef.current === poi.id) detailLoadRef.current = null
      setSheetDetailLoading(false)
    }
  }

  async function refreshSheetNotes(poiId: string) {
    try {
      setPoiNotes(await listPoiNotesApi(poiId))
    } catch {
      // Keep the current snapshot when offline or the notes endpoint is unavailable.
    }
  }

  async function refreshSheetReviews(poiId: string) {
    try {
      setPoiReviews(await listPoiReviewsApi(poiId))
    } catch {
      // Keep the current snapshot when offline or the reviews endpoint is unavailable.
    }
    if (token) {
      try {
        const mine = await getMyPoiReviewApi(poiId, token)
        setMyRating(mine?.rating ?? 0)
        setMyComment(mine?.comment ?? '')
      } catch {
        // Anonymous or expired sessions simply won't prefill the composer.
      }
    } else {
      setMyRating(0)
      setMyComment('')
    }
  }

  async function submitSheetNote(poiId: string) {
    if (!token) {
      setSheetDetailError(text('登录后才能添加备注'))
      return
    }
    if (submittingNote || !noteText.trim()) return
    setSubmittingNote(true)
    try {
      await addPoiNoteApi(poiId, { text: noteText.trim(), noteType }, token)
      setNoteText('')
      setNoteType('info')
      setAddingNote(false)
      await refreshSheetNotes(poiId)
    } catch (err: any) {
      setSheetDetailError(err?.message ?? text('添加备注失败'))
    } finally {
      setSubmittingNote(false)
    }
  }

  async function removeSheetNote(poiId: string, noteId: string) {
    if (!token) return
    try {
      await deletePoiNoteApi(poiId, noteId, token)
      setPoiNotes((current) => current.filter((note) => note.id !== noteId))
    } catch (err: any) {
      setSheetDetailError(err?.message ?? text('删除备注失败'))
    }
  }

  async function submitSheetReview(poiId: string) {
    if (!token) {
      setSheetDetailError(text('登录后才能评价地标'))
      return
    }
    if (savingReview || myRating < 1) return
    setSavingReview(true)
    try {
      await upsertPoiReviewApi(poiId, { rating: myRating, comment: myComment.trim() || undefined }, token)
      const fresh = await getPoiApi(poiId)
      setSheetDetailPoi(fresh)
      setSelectedPoi((current) => current?.id === poiId ? fresh : current)
      void poiStore.upsertDetail(fresh).catch(() => undefined)
      await refreshSheetReviews(poiId)
    } catch (err: any) {
      setSheetDetailError(err?.message ?? text('提交评价失败'))
    } finally {
      setSavingReview(false)
    }
  }

  function selectPoi(poi: POI) {
    sheetDismissingRef.current = false
    suppressNextMapPressRef.current = true
    setSelectedPoi(poi)
    setDetailTab('详情')
    setSheetDetailPoi(null)
    setSheetDetailError(null)
    setSheetDetailLoading(false)
    setPoiNotes(poi.notes ?? [])
    setPoiReviews([])
    setMyRating(0)
    setMyComment('')
    setNoteText('')
    setNoteType('info')
    setAddingNote(false)
    setSheetExpanded(false)
    setTimeout(() => {
      suppressNextMapPressRef.current = false
    }, 120)
  }

  function clearSelectedPoiFromMapPress() {
    if (suppressNextMapPressRef.current) {
      suppressNextMapPressRef.current = false
      return
    }
    if (selectedPoi) dismissSheet()
  }

  function handleSheetScroll(event: any) {
    if (!sheetExpanded || sheetDismissingRef.current) return
    if (event.nativeEvent.contentOffset.y < -72) dismissSheet()
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
        onPress={clearSelectedPoiFromMapPress}
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
              onPress={() => selectPoi(poi)}
            >
              <TouchableOpacity style={s.markerWrap} activeOpacity={0.82} onPress={() => selectPoi(poi)}>
                <View style={[s.markerBody, { backgroundColor: color }]}>
                  <Text style={s.markerText}>{iconForPoi(poi)}</Text>
                </View>
              </TouchableOpacity>
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

      {!selectedPoi ? (
        <View style={s.zoomBadge} pointerEvents="none">
          <Text style={s.zoomBadgeText}>zoom {zoom} · {viewportMode}</Text>
        </View>
      ) : null}

      {selectedPoi ? (() => {
        const color = colorForCategory(selectedPoi.category)
        const categoryLabel = labelForCategory(selectedPoi.category, text)
        const detailPoi = sheetDetailPoi?.id === selectedPoi.id ? sheetDetailPoi : selectedPoi
        const isAnchorage = detailPoi.category === 'anchorage'
        const isBuoy = detailPoi.category === 'buoy_mooring'
        const isMarina = detailPoi.category === 'marina'
        const isQuay = detailPoi.category === 'public_quay'
        const isDryDock = detailPoi.category === 'dry_dock'
        const isHazard = detailPoi.category === 'hazard'
        const seabeds = Array.isArray(detailPoi.seabeds) && detailPoi.seabeds.length ? detailPoi.seabeds.join(' / ') : text('待补充')
        const protectionValues = Array.isArray(detailPoi.protections) ? detailPoi.protections.map((value) => value.trim().toLowerCase()).filter(Boolean) : []
        const protectionSet = new Set(protectionValues)
        const protectionLabels = protectionValues.length ? protectionValues.map((value) => localizeProtection(value, text)) : []
        const protections = protectionLabels.length ? protectionLabels.join(' / ') : text('待补充')
        const mooringTypes = Array.isArray(detailPoi.mooringTypes) && detailPoi.mooringTypes.length ? detailPoi.mooringTypes.join(' / ') : text('待补充')
        const approachNotes = [
          detailPoi.maxDraft ? text(isAnchorage ? '参考水深/吃水 {draft}m' : '建议吃水 {draft}m', { draft: detailPoi.maxDraft }) : null,
          detailPoi.maxLength && !isAnchorage ? text('建议船长 {length}m', { length: detailPoi.maxLength }) : null,
          detailPoi.maxBeam ? text('船宽 {beam}m', { beam: detailPoi.maxBeam }) : null,
        ].filter(Boolean).join(' · ') || text('待补充')
        const notice = detailPoi.warningNotes?.[0]?.text
          ?? detailPoi.stayLimit
          ?? (isHazard ? text('该区域存在限制或风险，航行前请核对当地公告与海图。') : null)
          ?? (detailPoi.status !== 'active' ? text('该地标状态需要确认，进港前请再次核对当地公告。') : null)
        const locationLine = detailPoi.address || detailPoi.region || detailPoi.country || text('待补充')
        const vitals = isHazard ? [
          [text('风险类型'), categoryLabel],
          [text('坐标'), coordinateLabel(detailPoi)],
          [text('区域'), detailPoi.region || detailPoi.country || text('待补充')],
          [text('状态'), detailPoi.status === 'restricted' ? text('限制') : text('需核对')],
        ] : isAnchorage ? [
          [text('海床'), seabeds],
          [text('遮蔽方向'), protectionLabels.length ? text('{count} 个方向', { count: protectionLabels.length }) : text('待补充')],
          [text('水深'), detailPoi.maxDraft ? `${detailPoi.maxDraft}m` : text('待补充')],
          [text('坐标'), coordinateLabel(detailPoi)],
        ] : isBuoy ? [
          [text('系泊'), mooringTypes],
          [text('船长'), detailPoi.maxLength ? text('≤ {length}m', { length: detailPoi.maxLength }) : text('待补充')],
          [text('吃水'), detailPoi.maxDraft ? `${detailPoi.maxDraft}m` : text('待补充')],
          [text('坐标'), coordinateLabel(detailPoi)],
        ] : isDryDock ? [
          [text('服务'), text('上排 / 维修')],
          [text('船长'), detailPoi.maxLength ? text('≤ {length}m', { length: detailPoi.maxLength }) : text('待补充')],
          [text('船宽'), detailPoi.maxBeam ? `${detailPoi.maxBeam}m` : text('待补充')],
          [text('电话'), detailPoi.phone || text('待补充')],
        ] : [
          [text(isQuay ? '靠泊' : '泊位'), detailPoi.maxLength ? text('≤ {length}m', { length: detailPoi.maxLength }) : text('待补充')],
          [text('吃水'), detailPoi.maxDraft ? `${detailPoi.maxDraft}m` : text('待补充')],
          [text('坐标'), coordinateLabel(detailPoi)],
          ...(isMarina && detailPoi.phone ? [[text('电话'), detailPoi.phone]] : []),
        ]
        const amenities = isHazard || isAnchorage ? [] : isDryDock ? [
          [text('维修'), detailPoi.hasRepair ?? true],
          [text('上排'), true],
          [text('垃圾'), detailPoi.hasWasteDisposal],
          [text('可预约'), detailPoi.bookable],
        ] as [string, boolean | undefined][] : isBuoy ? [
          [text('浮标'), true],
          [text('可预订'), detailPoi.bookable],
          [text('可过夜'), detailPoi.overnightAllowed],
        ] as [string, boolean | undefined][] : isQuay ? [
          [text('公共靠泊'), true],
          [text('淡水'), detailPoi.hasWater],
          [text('垃圾'), detailPoi.hasWasteDisposal],
          [text('可过夜'), detailPoi.overnightAllowed],
        ] as [string, boolean | undefined][] : [
          [text('淡水'), detailPoi.hasWater],
          [text('岸电'), detailPoi.hasPower],
          [text('燃油'), detailPoi.hasFuel],
          [text('维修'), detailPoi.hasRepair],
          [text('垃圾'), detailPoi.hasWasteDisposal],
          [text('可预订'), detailPoi.bookable],
        ] as [string, boolean | undefined][]
        const conditions = isHazard ? [
          [text('说明'), detailPoi.description || text('该地标用于标记禁锚、浅滩、礁石、限制区或其他航行风险。')],
          [text('建议'), text('靠近前核对官方海图、航行通告和当地规定。')],
        ] : isAnchorage ? [
          [text('锚泊方式'), mooringTypes],
          [text('海床'), seabeds],
          [text('遮蔽'), protections],
          [text('过夜'), detailPoi.overnightAllowed === false ? text('不建议') : text('可参考')],
        ] : isBuoy ? [
          [text('系泊方式'), mooringTypes],
          [text('费用'), detailPoi.feeInfo || text('待补充')],
          [text('预订'), detailPoi.bookable ? text('可预订') : text('待补充')],
        ] : [
          [text('泊靠条件'), approachNotes],
          [text('费用 / 时区'), `${detailPoi.feeInfo || text('待补充')} · ${detailPoi.timezone || text('待补充')}`],
        ]
        const infoKicker = isHazard ? 'RISK INFO · 风险信息' : isAnchorage ? 'ANCHORAGE · 锚泊条件' : isBuoy ? 'MOORING · 浮标泊位' : isDryDock ? 'YARD INFO · 船坞维修' : isQuay ? 'QUAY INFO · 公共泊靠' : 'PORT INFO · 港口信息'
        const detailKicker = isHazard ? 'NOTICE · 航行提示' : isAnchorage ? 'ANCHORING · 锚地说明' : isDryDock ? 'SERVICE · 服务说明' : 'DETAIL · 泊靠说明'
        const currentNotes = poiNotes.length ? poiNotes : (detailPoi.notes ?? [])
        const currentReviews = poiReviews
        const reviewAverage = detailPoi.rating?.toFixed(1) ?? '—'
        const reviewCount = Math.max(detailPoi.commentsCount ?? 0, currentReviews.length)
        const photoKinds = ['marina', 'sail', 'sunrise', 'hero', 'crew', 'storm']
        return (
          <Animated.View
            style={[s.poiSheet, sheetExpanded && s.poiSheetFull, { transform: [{ translateY: sheetTranslateY }] }]}
            {...(!sheetExpanded ? sheetPanResponder.panHandlers : {})}
          >
            {!sheetExpanded ? (
              <View style={s.sheetHandleZone}>
                <View style={s.sheetHandle} />
              </View>
            ) : null}
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={sheetExpanded}
              onScroll={handleSheetScroll}
              scrollEventThrottle={16}
              contentContainerStyle={[s.sheetContent, sheetExpanded && s.sheetContentFull]}
            >
              {!sheetExpanded ? (
                <>
                  <View style={s.sheetHeader}>
                    <View style={[s.sheetIcon, { backgroundColor: color }]}>
                      <Text style={s.sheetIconText}>{iconForPoi(selectedPoi)}</Text>
                    </View>
                    <View style={s.sheetHeaderText}>
                      <Text style={[s.sheetKicker, { color }]}>{categoryLabel.toUpperCase()}</Text>
                      <Text style={s.panelTitle} numberOfLines={2}>{selectedPoi.name}</Text>
                      <Text style={s.panelText}>{shortInfoOf(selectedPoi, text)}</Text>
                    </View>
                  </View>
                  <View style={s.sheetBlock}>
                    <Text style={s.sheetBlockText}>
                      {selectedPoi.region || selectedPoi.country || coordinateLabel(selectedPoi)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.detailHero}>
                    <LinearGradient colors={['#38627c', '#17446f', '#102a4f']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.detailPhotoBase} />
                    <View style={s.detailPhotoStripeLayer}>
                      {Array.from({ length: 30 }).map((_, index) => (
                        <View key={index} style={[s.detailPhotoStripe, { left: index * 18 - 180, top: -70 }]} />
                      ))}
                    </View>
                    <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.detailPhotoHorizon} />
                    <Text style={s.detailPhotoLabel}>// {categoryLabel.toUpperCase()} · {detailPoi.region || detailPoi.country || 'POI'}</Text>
                    <LinearGradient colors={['rgba(0,0,0,0.40)', 'rgba(0,0,0,0)', '#f6f4ef']} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                    <View style={s.heroChrome}>
                      <TouchableOpacity style={s.heroChromeBtn} onPress={dismissSheet}>
                        <Text style={s.heroChromeBtnText}>‹</Text>
                      </TouchableOpacity>
                      <View style={s.heroRightActions}>
                        <View style={s.heroChromeBtn}>
                          <Text style={s.heroStatusText}>♡</Text>
                        </View>
                        <View style={s.heroChromeBtn}>
                          <Text style={s.heroStatusText}>↗</Text>
                        </View>
                      </View>
                    </View>
                    <View style={s.detailHeroTop}>
                      <View style={s.detailHeroPillRow}>
                        <View style={[s.detailHeroTypePill, { backgroundColor: `${color}cc` }]}>
                          <Text style={s.detailHeroTypeText}>{categoryLabel.toUpperCase()}</Text>
                        </View>
                        <View style={s.detailHeroStatusPill}>
                          <View style={s.detailHeroStatusDot} />
                          <Text style={s.detailHeroStatusText}>{text('已同步')}</Text>
                        </View>
                      </View>
                      <Text style={s.detailHeroTitle} numberOfLines={2}>{detailPoi.name}</Text>
                      <View style={s.detailHeroMetaRow}>
                        <Text style={s.detailHeroMeta}>★ {detailPoi.rating ?? '4.8'}</Text>
                        <Text style={s.detailHeroMetaDot}>·</Text>
                        <Text style={s.detailHeroMeta}>{detailPoi.region || detailPoi.country || text('海域待标注')}</Text>
                        <Text style={s.detailHeroMetaDot}>·</Text>
                        <Text style={s.detailHeroMeta}>{coordinateLabel(detailPoi)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={s.detailBody}>
                    {sheetDetailLoading ? (
                      <View style={s.noteCard}>
                        <Text style={s.sheetLoadingText}>{text('正在加载详情...')}</Text>
                      </View>
                    ) : null}

                    {sheetDetailError ? (
                      <View style={s.noteCard}>
                        <Text style={s.sheetBlockTitle}>{text('详情加载失败')}</Text>
                        <Text style={s.sheetBlockText}>{sheetDetailError}</Text>
                      </View>
                    ) : null}

                    <View style={s.quickActionRow}>
                      <TouchableOpacity style={s.quickActionPrimary}>
                        <Text style={s.quickActionPrimaryText}>↗ {text('导航前往')}</Text>
                      </TouchableOpacity>
                      {(isMarina || isDryDock) && detailPoi.phone ? (
                        <TouchableOpacity style={s.quickActionIconBtn}>
                          <Text style={s.quickActionIconText}>☎</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity style={s.quickActionIconBtn}>
                        <Text style={s.quickActionIconText}>☰</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={s.detailTabsRow}>
                      {(['详情', '评价', '照片'] as const).map((tab) => {
                        const active = detailTab === tab
                        return (
                          <TouchableOpacity key={tab} style={s.detailTabBtn} onPress={() => setDetailTab(tab)}>
                            <Text style={[s.detailTabText, { color: active ? '#0d3460' : 'rgba(13,52,96,0.62)' }]}>{text(tab)}</Text>
                            {active ? <View style={s.detailTabUnderline} /> : null}
                          </TouchableOpacity>
                        )
                      })}
                    </View>

                    {detailTab === '详情' ? (
                      <>
                        {notice ? (
                          <View style={s.noticeStrip}>
                            <View style={s.noticeIcon}>
                              <Text style={s.noticeIconText}>!</Text>
                            </View>
                            <Text style={s.noticeText}>{notice}</Text>
                          </View>
                        ) : null}

                        <View style={s.cardPad}>
                          <Text style={s.sectionKicker}>{infoKicker}</Text>
                          <View style={s.vitalsGrid}>
                            {vitals.map(([label, value]) => (
                              <View key={label} style={s.vitalCell}>
                                <Text style={s.vitalLabel}>{label}</Text>
                                <Text style={s.vitalValue}>{value}</Text>
                              </View>
                            ))}
                          </View>
                          {isAnchorage ? (
                            <View style={s.protectionCompassWrap}>
                              <View style={s.protectionCompass}>
                                <View style={s.protectionCompassRing} />
                                <View style={s.protectionCompassCrossV} />
                                <View style={s.protectionCompassCrossH} />
                                {PROTECTION_DIRECTIONS.map((direction) => {
                                  const active = protectionSet.has(direction.key)
                                  return (
                                    <View
                                      key={direction.key}
                                      style={[
                                        s.protectionDirection,
                                        {
                                          left: direction.x,
                                          top: direction.y,
                                          backgroundColor: active ? '#059669' : 'rgba(13,52,96,0.08)',
                                          borderColor: active ? 'rgba(255,255,255,0.90)' : 'rgba(13,52,96,0.10)',
                                        },
                                      ]}
                                    >
                                      <Text style={[s.protectionDirectionText, { color: active ? '#fff' : 'rgba(13,52,96,0.34)' }]}>{direction.short}</Text>
                                    </View>
                                  )
                                })}
                                <View style={s.protectionCenter}>
                                  <Text style={s.protectionCenterIcon}>⌾</Text>
                                </View>
                              </View>
                              <View style={s.protectionLegend}>
                                <Text style={s.protectionLegendTitle}>{text('风浪遮蔽')}</Text>
                                <Text style={s.protectionLegendText}>
                                  {protectionLabels.length ? text('绿色方向表示该锚地对对应来向风浪有遮蔽。') : text('这个锚地还没有遮蔽方向数据。')}
                                </Text>
                                {protectionLabels.length ? (
                                  <View style={s.protectionLegendPills}>
                                    {protectionLabels.map((label) => (
                                      <View key={label} style={s.protectionPill}>
                                        <Text style={s.protectionPillText}>{label}</Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          ) : null}
                          <View style={s.addressDivider} />
                          <Text style={s.vitalLabel}>{isHazard || isAnchorage ? text('区域') : text('位置')}</Text>
                          <Text style={s.vitalValue}>{locationLine}</Text>
                        </View>

                        {amenities.length ? (
                          <View style={s.cardPad}>
                            <Text style={s.sectionKicker}>{isDryDock ? 'SERVICES · 服务' : 'AMENITIES · 设施'}</Text>
                            <View style={s.amenitiesGrid}>
                              {amenities.map(([label, ok]) => (
                                <View key={label} style={s.amenityTile}>
                                  <Text style={[s.amenityValue, { color: ok ? '#059669' : 'rgba(13,52,96,0.32)' }]}>{ok ? '✓' : '—'}</Text>
                                  <Text style={s.amenityLabel}>{label}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}

                        <View style={s.cardPad}>
                          <Text style={s.sectionKicker}>{detailKicker}</Text>
                          <Text style={s.sheetBlockText}>
                            {detailPoi.description || text('这条地标目前已完成基础同步，详细泊靠说明和实拍补充还在整理中。')}
                          </Text>
                          <View style={s.addressDivider} />
                          {conditions.map(([label, value], index) => (
                            <View key={label} style={index > 0 ? { marginTop: 10 } : null}>
                              <Text style={s.vitalLabel}>{label}</Text>
                              <Text style={s.vitalValue}>{value}</Text>
                            </View>
                          ))}
                        </View>

                        <View style={s.cardPad}>
                          <View style={s.noteHeaderRow}>
                            <Text style={[s.sectionKicker, { marginBottom: 0 }]}>{text('NOTES · 备注与提醒')}</Text>
                            <TouchableOpacity onPress={() => setAddingNote((current) => !current)}>
                              <Text style={s.inlineActionText}>{addingNote ? text('收起') : text('添加')}</Text>
                            </TouchableOpacity>
                          </View>

                          {addingNote ? (
                            <View style={s.noteComposer}>
                              <View style={s.noteTypeRow}>
                                {(['info', 'warning'] as const).map((type) => {
                                  const active = noteType === type
                                  return (
                                    <TouchableOpacity
                                      key={type}
                                      style={[s.noteTypeChip, active && (type === 'warning' ? s.noteTypeChipWarn : s.noteTypeChipActive)]}
                                      onPress={() => setNoteType(type)}
                                    >
                                      <Text style={[s.noteTypeChipText, active && s.noteTypeChipTextActive]}>
                                        {type === 'warning' ? text('警告') : text('普通')}
                                      </Text>
                                    </TouchableOpacity>
                                  )
                                })}
                              </View>
                              <TextInput
                                value={noteText}
                                onChangeText={setNoteText}
                                placeholder={text('记录实地提醒、停泊注意事项或临时变化')}
                                placeholderTextColor="rgba(13,52,96,0.38)"
                                multiline
                                style={s.noteInput}
                              />
                              <TouchableOpacity
                                style={[s.submitBtn, (!noteText.trim() || submittingNote) && s.submitBtnDisabled]}
                                disabled={!noteText.trim() || submittingNote}
                                onPress={() => void submitSheetNote(detailPoi.id)}
                              >
                                <Text style={s.submitBtnText}>{submittingNote ? text('提交中') : text('发布备注')}</Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}

                          {currentNotes.length ? currentNotes.map((note) => {
                            const warning = note.noteType === 'warning'
                            const canDelete = !!user?.id && note.createdBy === user.id
                            return (
                              <View key={note.id} style={[s.noteItem, warning && s.noteItemWarn]}>
                                <View style={s.noteItemTop}>
                                  <Text style={[s.noteBadge, warning && s.noteBadgeWarn]}>
                                    {warning ? text('警告提醒') : text('航友备注')}
                                    {note.createdByRole ? ` · ${note.createdByRole}` : ''}
                                  </Text>
                                  {canDelete ? (
                                    <TouchableOpacity onPress={() => void removeSheetNote(detailPoi.id, note.id)}>
                                      <Text style={s.noteDeleteText}>{text('删除')}</Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                                <Text style={s.noteBody}>{note.text}</Text>
                              </View>
                            )
                          }) : (
                            <Text style={s.emptyText}>{text('还没有备注。到过这里的航友可以补充实地提醒。')}</Text>
                          )}
                        </View>
                      </>
                    ) : null}

                    {detailTab === '评价' ? (
                      <View style={s.cardPad}>
                        <View style={s.ratingSummary}>
                          <View>
                            <Text style={s.ratingBig}>★ {reviewAverage}</Text>
                            <Text style={s.ratingCaption}>{text('{count} 条评价', { count: reviewCount })}</Text>
                          </View>
                          <Text style={s.reviewStars}>{'★'.repeat(Math.max(0, Math.round(detailPoi.rating ?? 0)))}{'☆'.repeat(Math.max(0, 5 - Math.round(detailPoi.rating ?? 0)))}</Text>
                        </View>

                        <View style={s.reviewComposer}>
                          <Text style={s.noteBadge}>{text('我的评价')}</Text>
                          <View style={s.starRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <TouchableOpacity key={star} style={s.starBtn} onPress={() => setMyRating(star)}>
                                <Text style={[s.starText, myRating >= star && s.starTextOn]}>★</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TextInput
                            value={myComment}
                            onChangeText={setMyComment}
                            placeholder={text('写下靠泊体验、海况、服务或避风感受')}
                            placeholderTextColor="rgba(13,52,96,0.38)"
                            multiline
                            style={s.noteInput}
                          />
                          <TouchableOpacity
                            style={[s.submitBtn, (myRating < 1 || savingReview) && s.submitBtnDisabled]}
                            disabled={myRating < 1 || savingReview}
                            onPress={() => void submitSheetReview(detailPoi.id)}
                          >
                            <Text style={s.submitBtnText}>{savingReview ? text('提交中') : text('提交评价')}</Text>
                          </TouchableOpacity>
                        </View>

                        {currentReviews.length ? currentReviews.map((review) => (
                          <View key={review.id} style={s.reviewItem}>
                            <View style={s.reviewTop}>
                              <View style={s.reviewAvatar}>
                                <Text style={s.reviewAvatarText}>{(review.user?.nickname || 'U').slice(0, 1).toUpperCase()}</Text>
                              </View>
                              <View>
                                <Text style={s.reviewName}>{review.user?.nickname || text('航友')}</Text>
                                <Text style={s.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</Text>
                              </View>
                            </View>
                            <Text style={s.reviewText}>{review.comment || text('这位航友只留下了评分。')}</Text>
                          </View>
                        )) : (
                          <Text style={s.emptyText}>{text('暂无评价。你可以成为第一个补充实地体验的人。')}</Text>
                        )}
                      </View>
                    ) : null}

                    {detailTab === '照片' ? (
                      <View style={s.photoGrid}>
                        {photoKinds.map((kind, index) => (
                          <View key={`${kind}-${index}`} style={s.photoTile}>
                            <LinearGradient
                              colors={index % 3 === 0 ? ['#765444', '#23335e', '#152342'] : index % 3 === 1 ? ['#b9c9d2', '#38627c', '#173457'] : ['#17446f', '#102a4f']}
                              start={{ x: 0.1, y: 0 }}
                              end={{ x: 0.9, y: 1 }}
                              style={StyleSheet.absoluteFill}
                            />
                            <View style={s.photoTileStripeLayer}>
                              {Array.from({ length: 10 }).map((_, stripeIndex) => (
                                <View key={stripeIndex} style={[s.photoTileStripe, { left: stripeIndex * 17 - 60, top: -24 }]} />
                              ))}
                            </View>
                            <View style={s.photoTileHorizon} />
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </>
              )}
            </ScrollView>
          </Animated.View>
        )
      })() : null}
    </View>
  )
}
