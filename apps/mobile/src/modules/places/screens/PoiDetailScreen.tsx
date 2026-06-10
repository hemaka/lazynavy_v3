import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Linking, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { POI, PoiNote, PoiReview } from '@lazynavy-v3/types'
import { addPoiFavoriteApi, addPoiNoteApi, deletePoiNoteApi, getMyPoiReviewApi, getPoiApi, isPoiFavoritedApi, listPoiNotesApi, listPoiReviewsApi, removePoiFavoriteApi, upsertPoiReviewApi } from '../api/client'
import { poiStore } from '../offline/poiStore'
import { colorForCategory, coordinateLabel, iconForPoi, labelForCategory, localizeMooring, localizeSeabed, metaTagsOf } from '../utils/present'
import { useAuth } from '../../identity/public'
import { useTheme } from '../../../theme'
import { useI18n } from '../../../i18n'

function fieldValue(value?: string | number | null, fallback = '待补充') {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value.trim() || fallback
  return String(value)
}

export default function PoiDetailScreen() {
  const t = useTheme()
  const { text } = useI18n()
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id
  const id = rawId ?? null
  const { token, isLoggedIn, user } = useAuth()
  const [poi, setPoi] = useState<POI | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offlineMode, setOfflineMode] = useState(false)
  // 备注本地态:用 listPoiNotesApi 单独维护,便于增删后即时刷新(POI 详情快照不一定含最新备注)。
  const [notes, setNotes] = useState<PoiNote[]>([])
  const [adding, setAdding] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<'info' | 'warning'>('info')
  const [submitting, setSubmitting] = useState(false)

  async function refreshNotes(poiId: string) {
    try { setNotes(await listPoiNotesApi(poiId)) } catch { /* 离线/失败时保留 */ }
  }

  async function submitNote() {
    if (!id || !token || submitting || !noteText.trim()) return
    setSubmitting(true)
    try {
      await addPoiNoteApi(id, { text: noteText.trim(), noteType }, token)
      setNoteText('')
      setAdding(false)
      setNoteType('info')
      await refreshNotes(id)
    } catch (err: any) {
      setError(err?.message ?? text('添加备注失败'))
    } finally {
      setSubmitting(false)
    }
  }

  async function removeNote(noteId: string) {
    if (!id || !token) return
    try {
      await deletePoiNoteApi(id, noteId, token)
      setNotes((current) => current.filter((n) => n.id !== noteId))
    } catch (err: any) {
      setError(err?.message ?? text('删除备注失败'))
    }
  }

  // 详情快照里的 notes 先垫上,联网后用专用接口刷新到最新。
  useEffect(() => { if (poi?.notes) setNotes(poi.notes) }, [poi])
  useEffect(() => { if (id && !offlineMode) void refreshNotes(id) }, [id, offlineMode])

  // 收藏/喜欢
  const [favorited, setFavorited] = useState(false)
  const [favBusy, setFavBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!id || !token || offlineMode) return
    isPoiFavoritedApi(id, token).then((res) => { if (!cancelled) setFavorited(res.favorited) }).catch(() => {})
    return () => { cancelled = true }
  }, [id, token, offlineMode])

  async function toggleFavorite() {
    if (!id || favBusy) return
    if (!token) { setError(text('登录后才能收藏地标')); return }
    setFavBusy(true)
    const prev = favorited
    setFavorited(!prev)
    try {
      const res = prev ? await removePoiFavoriteApi(id, token) : await addPoiFavoriteApi(id, token)
      setFavorited(res.favorited)
    } catch (err: any) {
      setFavorited(prev)
      setError(err?.message ?? text('操作失败'))
    } finally {
      setFavBusy(false)
    }
  }

  // 评价/评分
  const [reviews, setReviews] = useState<PoiReview[]>([])
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [savingReview, setSavingReview] = useState(false)

  async function refreshReviews(poiId: string) {
    try { setReviews(await listPoiReviewsApi(poiId)) } catch { /* 离线保留 */ }
    if (token) {
      try {
        const mine = await getMyPoiReviewApi(poiId, token)
        if (mine) { setMyRating(mine.rating); setMyComment(mine.comment ?? '') }
      } catch { /* 忽略 */ }
    }
  }

  async function submitReview() {
    if (!id || !token || savingReview || myRating < 1) return
    setSavingReview(true)
    try {
      await upsertPoiReviewApi(id, { rating: myRating, comment: myComment.trim() || undefined }, token)
      const fresh = await getPoiApi(id) // 拉新聚合 rating/commentsCount
      setPoi(fresh)
      await refreshReviews(id)
    } catch (err: any) {
      setError(err?.message ?? text('提交评价失败'))
    } finally {
      setSavingReview(false)
    }
  }

  useEffect(() => { if (id && !offlineMode) void refreshReviews(id) }, [id, offlineMode])

  async function sharePoi() {
    if (!poi) return
    const where = poi.address || poi.region || poi.country
    try {
      await Share.share({ message: where ? `${poi.name} · ${where}` : poi.name })
    } catch {
      /* 用户取消分享,忽略 */
    }
  }

  useEffect(() => {
    if (!id) {
      setError(text('缺少地标 ID'))
      setLoading(false)
      return
    }
    const poiId = id

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setOfflineMode(false)
      let cached: POI | null = null

      try {
        cached = await poiStore.getById(poiId)
        if (!cancelled && cached) {
          setPoi(cached)
          setOfflineMode(true)
          setLoading(false)
        }
      } catch {
        // Cache read failures should not block the online detail request.
      }

      try {
        const next = await getPoiApi(poiId)
        if (!cancelled) {
          setPoi(next)
          setOfflineMode(false)
        }
        void poiStore.upsertDetail(next).catch(() => undefined)
      } catch (err: any) {
        if (!cancelled) {
          if (cached) {
            setPoi(cached)
            setOfflineMode(true)
            setError(null)
          } else {
            setError(err?.message ?? text('加载地标失败'))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id, text])

  const s = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    hero: { height: 336, backgroundColor: t.oceanDeep },
    heroImage: { width: '100%', height: '100%' },
    heroFallback: {
      flex: 1,
      backgroundColor: t.oceanDeep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroFallbackIcon: { color: t.accentBright, fontSize: 54, fontWeight: '700', fontFamily: 'monospace' },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 18,
      paddingTop: 6,
      backgroundColor: t.photoOverlay,
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(7,29,54,0.48)',
      borderWidth: 0.5,
      borderColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    topRightGroup: { flexDirection: 'row', gap: 8 },
    favOn: { color: '#f87171' },
    headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', marginHorizontal: 10, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
    heroBottom: { gap: 10 },
    categoryPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(7,29,54,0.58)',
      borderWidth: 0.5,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    categoryPillText: { color: '#fff', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1 },
    heroTitle: { color: '#fff', fontSize: 28, fontWeight: '700' },
    heroMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19 },
    sheet: {
      marginTop: -26,
      flex: 1,
      backgroundColor: t.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 0.5,
      borderColor: t.border,
      borderBottomWidth: 0,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 999,
      backgroundColor: t.textSoft,
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: 14,
    },
    section: { paddingHorizontal: 16, paddingBottom: 18 },
    actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 18 },
    primaryBtn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    secondaryBtn: {
      paddingHorizontal: 14,
      height: 46,
      borderRadius: 14,
      backgroundColor: t.elevated,
      borderWidth: 0.5,
      borderColor: t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: { color: t.text, fontSize: 13, fontWeight: '700' },
    statRow: { flexDirection: 'row', gap: 10 },
    statCard: {
      flex: 1,
      padding: 12,
      borderRadius: 16,
      backgroundColor: t.elevated,
      borderWidth: 0.5,
      borderColor: t.border,
      gap: 5,
    },
    statLabel: { color: t.textSoft, fontSize: 10.5, fontFamily: 'monospace', letterSpacing: 1 },
    statValue: { color: t.text, fontSize: 18, fontWeight: '700' },
    statHint: { color: t.textDim, fontSize: 11.5, lineHeight: 16 },
    block: {
      borderRadius: 18,
      backgroundColor: t.elevated,
      borderWidth: 0.5,
      borderColor: t.border,
      padding: 14,
      gap: 12,
    },
    blockTitle: { color: t.text, fontSize: 16, fontWeight: '700' },
    blockText: { color: t.textDim, fontSize: 13.5, lineHeight: 21 },
    noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    noteAdd: { color: t.accent, fontSize: 13, fontWeight: '700' },
    noteForm: { gap: 10, marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: t.elevated },
    noteTypeRow: { flexDirection: 'row', gap: 8 },
    noteTypeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border },
    noteTypeChipActive: { backgroundColor: t.accent, borderColor: t.accent },
    noteTypeChipWarn: { backgroundColor: t.danger, borderColor: t.danger },
    noteTypeChipText: { color: t.textDim, fontSize: 12.5, fontWeight: '700' },
    noteTypeChipTextActive: { color: '#fff' },
    noteInput: { color: t.text, fontSize: 14, minHeight: 64, textAlignVertical: 'top', backgroundColor: t.surface, borderRadius: 10, padding: 10 },
    noteSubmit: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: t.accent },
    noteSubmitDisabled: { opacity: 0.5 },
    noteSubmitText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    noteItem: { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: t.elevated, gap: 4 },
    noteItemWarn: { backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 0.5, borderColor: 'rgba(248,113,113,0.4)' },
    noteItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    noteBadge: { color: t.textDim, fontSize: 11, fontWeight: '800' },
    noteBadgeWarn: { color: t.danger },
    noteDelete: { color: t.textSoft, fontSize: 12, fontWeight: '600' },
    noteBody: { color: t.text, fontSize: 14, lineHeight: 20 },
    reviewAgg: { color: t.accent, fontSize: 13, fontWeight: '700' },
    reviewForm: { gap: 10, marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: t.elevated },
    starRow: { flexDirection: 'row', gap: 6 },
    star: { color: t.textSoft, fontSize: 26, lineHeight: 30 },
    starOn: { color: '#f59e0b' },
    reviewItem: { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: t.elevated, gap: 4 },
    reviewName: { color: t.text, fontSize: 14, fontWeight: '600', flex: 1 },
    reviewStars: { color: '#f59e0b', fontSize: 13 },
    offlineBanner: {
      borderRadius: 16,
      backgroundColor: 'rgba(14,165,233,0.12)',
      borderWidth: 0.5,
      borderColor: 'rgba(14,165,233,0.38)',
      padding: 12,
      gap: 4,
    },
    offlineTitle: { color: t.text, fontSize: 13, fontWeight: '800' },
    offlineText: { color: t.textDim, fontSize: 12, lineHeight: 18 },
    infoGrid: { gap: 10 },
    infoItem: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: t.surfaceAlt,
      borderWidth: 0.5,
      borderColor: t.border,
      gap: 4,
    },
    infoLabel: { color: t.textSoft, fontSize: 10.5, fontFamily: 'monospace', letterSpacing: 1 },
    infoValue: { color: t.text, fontSize: 14, lineHeight: 20 },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: t.surfaceAlt,
      borderWidth: 0.5,
      borderColor: t.border,
    },
    tagText: { color: t.textDim, fontSize: 12, fontWeight: '600' },
    stateWrap: { paddingHorizontal: 24, paddingTop: 120, alignItems: 'center', gap: 12 },
    stateText: { color: t.textDim, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  }), [t])

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <StatusBar barStyle={t.statusDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={s.stateWrap}>
          <ActivityIndicator color={t.accent} />
          <Text style={s.stateText}>{text('正在读取地标详情…')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !poi) {
    return (
      <SafeAreaView style={s.screen}>
        <StatusBar barStyle={t.statusDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={s.stateWrap}>
          <Text style={s.stateText}>{error ?? text('地标不存在')}</Text>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.back()}>
            <Text style={s.secondaryBtnText}>{text('返回地图')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const color = colorForCategory(poi.category)
  const categoryLabel = labelForCategory(poi.category, text)
  const metaTags = metaTagsOf(poi, text)
  const seabeds = poi.seabeds.length ? poi.seabeds.map((value) => localizeSeabed(value, text)) : [text('海床信息待补')]
  const protections = poi.protections.length ? poi.protections : [text('风浪遮蔽信息待补')]
  const moorings = poi.mooringTypes.length ? poi.mooringTypes.map((value) => localizeMooring(value, text)) : [text('锚泊方式待补')]
  const offlineFallback = offlineMode ? text('离线状态不可读') : text('待补充')

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle={t.statusDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <View style={s.hero}>
        {poi.picture && !offlineMode ? (
          <Image source={{ uri: poi.picture }} style={s.heroImage} resizeMode="cover" />
        ) : (
          <View style={s.heroFallback}>
            <Text style={s.heroFallbackIcon}>{iconForPoi(poi)}</Text>
          </View>
        )}

        <SafeAreaView style={s.heroOverlay}>
          <View style={s.topRow}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
              <Text style={s.iconBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle} numberOfLines={1}>{poi.name}</Text>
            <View style={s.topRightGroup}>
              <TouchableOpacity style={s.iconBtn} onPress={() => void toggleFavorite()} disabled={favBusy}>
                <Text style={[s.iconBtnText, favorited && s.favOn]}>{favorited ? '♥' : '♡'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => void sharePoi()}>
                <Text style={s.iconBtnText}>↗</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.heroBottom}>
            <View style={[s.categoryPill, { backgroundColor: `${color}55`, borderColor: `${color}88` }]}>
              <Text style={s.categoryPillText}>{categoryLabel.toUpperCase()}</Text>
            </View>
            <Text style={s.heroTitle}>{poi.name}</Text>
            <Text style={s.heroMeta}>
              {poi.region || poi.country || text('海域待标注')}
              {' · '}
              ★ {poi.rating?.toFixed(1) ?? '—'}
              {' · '}
              {poi.commentsCount} {text('条讨论')}
            </Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={s.sheet} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={s.handle} />

        {offlineMode ? (
          <View style={s.section}>
            <View style={s.offlineBanner}>
              <Text style={s.offlineTitle}>{text('本地缓存')}</Text>
              <Text style={s.offlineText}>{text('当前离线，已显示本地基础信息。图片、来源、备注和最新讨论需联网读取。')}</Text>
            </View>
          </View>
        ) : null}

        <View style={s.actionRow}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/map')}>
            <Text style={s.primaryBtnText}>{text('回到地图查看位置')}</Text>
          </TouchableOpacity>
          {poi.sourceUrl ? (
            <TouchableOpacity style={s.secondaryBtn} onPress={() => void Linking.openURL(poi.sourceUrl!)}>
              <Text style={s.secondaryBtnText}>{text('打开来源')}</Text>
            </TouchableOpacity>
          ) : offlineMode ? (
            <View style={s.secondaryBtn}>
              <Text style={s.secondaryBtnText}>{text('来源需联网')}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.section}>
          <View style={s.statRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>DRAFT</Text>
              <Text style={s.statValue}>{poi.maxDraft ? `${poi.maxDraft}m` : '—'}</Text>
              <Text style={s.statHint}>{text('建议进港吃水')}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>LENGTH</Text>
              <Text style={s.statValue}>{poi.maxLength ? `${poi.maxLength}m` : '—'}</Text>
              <Text style={s.statHint}>{text('建议船长上限')}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>TYPE</Text>
              <Text style={[s.statValue, { color }]}>{iconForPoi(poi)}</Text>
              <Text style={s.statHint}>{categoryLabel}</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.block}>
            <Text style={s.blockTitle}>{text('地标摘要')}</Text>
            <Text style={s.blockText}>{fieldValue(
              poi.description,
              offlineMode ? text('离线状态不可读。当前仅显示已缓存的基础地标信息。') : text('这条地标目前已完成基础同步，详细泊靠说明和实拍补充还在整理中。'),
            )}</Text>
            {metaTags.length ? (
              <View style={s.tagWrap}>
                {metaTags.map((tag) => (
                  <View key={tag} style={s.tag}>
                    <Text style={s.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.section}>
          <View style={s.block}>
            <Text style={s.blockTitle}>{text('基础信息')}</Text>
            <View style={s.infoGrid}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>COORDINATES</Text>
                <Text style={s.infoValue}>{coordinateLabel(poi)}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>REGION</Text>
                <Text style={s.infoValue}>{fieldValue(poi.region || poi.country)}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>PHONE</Text>
                <Text style={s.infoValue}>{fieldValue(poi.phone, offlineFallback)}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>TIMEZONE</Text>
                <Text style={s.infoValue}>{fieldValue(poi.timezone, offlineFallback)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.block}>
            <Text style={s.blockTitle}>{text('泊靠条件')}</Text>
            <View style={s.infoGrid}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>SEABED</Text>
                <Text style={s.infoValue}>{poi.seabeds.length ? seabeds.join(' / ') : offlineFallback}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>PROTECTION</Text>
                <Text style={s.infoValue}>{poi.protections.length ? protections.join(' / ') : offlineFallback}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>MOORING</Text>
                <Text style={s.infoValue}>{poi.mooringTypes.length ? moorings.join(' / ') : offlineFallback}</Text>
              </View>
            </View>
          </View>
        </View>

        {!offlineMode ? (
          <View style={s.section}>
            <View style={s.block}>
              <View style={s.noteHeader}>
                <Text style={s.blockTitle}>{text('评价')}</Text>
                <Text style={s.reviewAgg}>
                  {typeof poi.rating === 'number' ? `★ ${poi.rating.toFixed(1)} · ${reviews.length} ${text('条')}` : `${reviews.length} ${text('条评价')}`}
                </Text>
              </View>

              <View style={s.reviewForm}>
                <View style={s.starRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => { if (!isLoggedIn) { setError(text('登录后才能评价')); return } setMyRating(n) }}>
                      <Text style={[s.star, n <= myRating && s.starOn]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={s.noteInput}
                  value={myComment}
                  onChangeText={setMyComment}
                  placeholder={text('说说你的体验(可选)')}
                  placeholderTextColor={t.textSoft}
                  multiline
                />
                <TouchableOpacity style={[s.noteSubmit, (myRating < 1 || savingReview) && s.noteSubmitDisabled]} onPress={() => void submitReview()} disabled={myRating < 1 || savingReview}>
                  <Text style={s.noteSubmitText}>{savingReview ? text('提交中…') : text('提交评价')}</Text>
                </TouchableOpacity>
              </View>

              {reviews.length === 0 ? (
                <Text style={s.blockText}>{text('还没有评价。给它打个分,帮助其他船友。')}</Text>
              ) : (
                reviews.map((review) => (
                  <View key={review.id} style={s.reviewItem}>
                    <View style={s.noteItemTop}>
                      <Text style={s.reviewName} numberOfLines={1}>{review.user?.nickname ?? text('航海者')}</Text>
                      <Text style={s.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                    </View>
                    {review.comment ? <Text style={s.noteBody}>{review.comment}</Text> : null}
                  </View>
                ))
              )}
            </View>

            <View style={s.block}>
              <View style={s.noteHeader}>
                <Text style={s.blockTitle}>{text('备注与提醒')}</Text>
                <TouchableOpacity
                  onPress={() => { if (!isLoggedIn) { setError(text('登录后才能添加备注')); return } setAdding((v) => !v) }}
                >
                  <Text style={s.noteAdd}>{adding ? text('收起') : text('＋ 添加')}</Text>
                </TouchableOpacity>
              </View>

              {adding ? (
                <View style={s.noteForm}>
                  <View style={s.noteTypeRow}>
                    {(['info', 'warning'] as const).map((typ) => (
                      <TouchableOpacity
                        key={typ}
                        style={[s.noteTypeChip, noteType === typ && (typ === 'warning' ? s.noteTypeChipWarn : s.noteTypeChipActive)]}
                        onPress={() => setNoteType(typ)}
                      >
                        <Text style={[s.noteTypeChipText, noteType === typ && s.noteTypeChipTextActive]}>{typ === 'warning' ? `⚠ ${text('警告')}` : text('普通')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={s.noteInput}
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder={noteType === 'warning' ? text('例如:入口处有暗礁,退潮注意吃水') : text('分享对这个地标的补充信息')}
                    placeholderTextColor={t.textSoft}
                    multiline
                  />
                  <TouchableOpacity style={[s.noteSubmit, (!noteText.trim() || submitting) && s.noteSubmitDisabled]} onPress={() => void submitNote()} disabled={!noteText.trim() || submitting}>
                    <Text style={s.noteSubmitText}>{submitting ? text('提交中…') : text('发布备注')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {notes.length === 0 ? (
                <Text style={s.blockText}>{text('还没有备注。任何人都可以加一条普通备注或⚠警告,帮助其他船友。')}</Text>
              ) : (
                notes.map((note) => (
                  <View key={note.id} style={[s.noteItem, note.noteType === 'warning' && s.noteItemWarn]}>
                    <View style={s.noteItemTop}>
                      <Text style={[s.noteBadge, note.noteType === 'warning' && s.noteBadgeWarn]}>
                        {note.noteType === 'warning' ? `⚠ ${text('警告')}` : text('普通')}
                      </Text>
                      {isLoggedIn && user?.id && note.createdBy === user.id ? (
                        <TouchableOpacity onPress={() => void removeNote(note.id)}><Text style={s.noteDelete}>{text('删除')}</Text></TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={s.noteBody}>{note.text}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <View style={s.block}>
              <Text style={s.blockTitle}>{text('完整详情')}</Text>
              <Text style={s.blockText}>{text('离线状态不可读。联网后会自动刷新地标图片、来源、备注、警告和最新讨论数据。')}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
