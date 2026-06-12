import { LinearGradient } from 'expo-linear-gradient'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import * as LocalAuthentication from 'expo-local-authentication'
import * as MediaLibrary from 'expo-media-library'
import Constants from 'expo-constants'
import { useLocalSearchParams } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type GestureResponderEvent,
  Image,
  Linking,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { AuthModal } from '../components/AuthModal'
import { useAuth } from '../context'
import type { AuthUser } from '../types'
import { getMyBadgesApi, setActiveBadgeApi, updateProfileApi, uploadProfileMediaApi } from '../api/client'
import { findBadge, SYSTEM_BADGE_CATALOG, type BadgeCatalogItem } from '../badges/catalog'
import { CountryRegionPicker } from '../../../shared/ui/CountryRegionPicker'
import { ImageSourceActionSheet } from '../../../shared/ui/ImageSourceActionSheet'
import {
  DEFAULT_PROFILE_SETTINGS,
  loadProfileSettings,
  saveProfileSettings,
  type LocalProfileSettings,
} from '../settings/profileSettings'
import { useTheme } from '../../../theme'
import { useI18n } from '../../../i18n'

type ProfilePanel = 'profile' | 'security' | 'appearance' | 'privacy'
type MediaKind = 'avatar' | 'cover'
type LanguagePickerKind = 'speech' | 'ui'
type LanguageOption = { value: string; label: string; detail: string }
type SourceTextFn = (source: string, vars?: Record<string, string | number>) => string

const PRIVATE_BIRTH_DATE = '1900-01-01'

const SPEECH_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'zh-CN', label: 'Mandarin Chinese', detail: '普通话' },
  { value: 'zh-HK', label: 'Cantonese', detail: '粤语' },
  { value: 'en-US', label: 'American English', detail: 'English (US)' },
  { value: 'en-GB', label: 'British English', detail: 'English (UK)' },
  { value: 'en-AU', label: 'Australian English', detail: 'English (AU)' },
  { value: 'ja-JP', label: 'Japanese', detail: '日本語' },
  { value: 'ko-KR', label: 'Korean', detail: '한국어' },
  { value: 'es-ES', label: 'Spanish', detail: 'Español' },
  { value: 'fr-FR', label: 'French', detail: 'Français' },
  { value: 'de-DE', label: 'German', detail: 'Deutsch' },
  { value: 'it-IT', label: 'Italian', detail: 'Italiano' },
  { value: 'pt-PT', label: 'Portuguese', detail: 'Português' },
  { value: 'ru-RU', label: 'Russian', detail: 'Русский' },
  { value: 'ar', label: 'Arabic', detail: 'العربية' },
  { value: 'hi-IN', label: 'Hindi', detail: 'हिन्दी' },
  { value: 'id-ID', label: 'Indonesian', detail: 'Bahasa Indonesia' },
  { value: 'ms-MY', label: 'Malay', detail: 'Bahasa Melayu' },
  { value: 'th-TH', label: 'Thai', detail: 'ไทย' },
  { value: 'vi-VN', label: 'Vietnamese', detail: 'Tiếng Việt' },
  { value: 'tl-PH', label: 'Filipino', detail: 'Filipino' },
]

const UI_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'zh-CN', label: '简体中文', detail: 'Chinese Simplified' },
  { value: 'zh-TW', label: '繁體中文', detail: 'Chinese Traditional' },
  { value: 'en', label: 'English', detail: 'English' },
  { value: 'ja', label: '日本語', detail: 'Japanese' },
  { value: 'ko', label: '한국어', detail: 'Korean' },
  { value: 'vi', label: 'Tiếng Việt', detail: 'Vietnamese' },
  { value: 'id', label: 'Bahasa Indonesia', detail: 'Indonesian' },
  { value: 'ms', label: 'Bahasa Melayu', detail: 'Malay' },
  { value: 'th', label: 'ไทย', detail: 'Thai' },
  { value: 'es', label: 'Español', detail: 'Spanish' },
  { value: 'pt', label: 'Português', detail: 'Portuguese' },
  { value: 'fr', label: 'Français', detail: 'French' },
  { value: 'de', label: 'Deutsch', detail: 'German' },
  { value: 'it', label: 'Italiano', detail: 'Italian' },
  { value: 'nl', label: 'Nederlands', detail: 'Dutch' },
  { value: 'ru', label: 'Русский', detail: 'Russian' },
  { value: 'ar', label: 'العربية', detail: 'Arabic' },
  { value: 'hi', label: 'हिन्दी', detail: 'Hindi' },
  { value: 'tr', label: 'Türkçe', detail: 'Turkish' },
  { value: 'tl', label: 'Filipino', detail: 'Filipino' },
]

interface MediaEditorState {
  kind: MediaKind
  uri: string
  width: number
  height: number
}

export function ProfileScreen() {
  const theme = useTheme()
  const params = useLocalSearchParams<{ panel?: string }>()
  const { isLoggedIn, user, ready, refreshUser, logout, token } = useAuth()
  const [authVisible, setAuthVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const openBadgePanel = params.panel === 'badges'

  const styles = useMemo(() => createStyles(theme), [theme])

  const handleRefresh = useCallback(async () => {
    if (!isLoggedIn) return
    setRefreshing(true)
    try {
      await refreshUser()
    } finally {
      setRefreshing(false)
    }
  }, [isLoggedIn, refreshUser])

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={theme.statusDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.accent} />}
      >
        {!ready ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : isLoggedIn && user ? (
          <SignedInProfile
            user={user}
            token={token}
            autoOpenBadges={openBadgePanel}
            onUpdated={refreshUser}
            onLogout={() => void logout()}
            styles={styles}
          />
        ) : (
          <GuestProfile onLogin={() => setAuthVisible(true)} styles={styles} />
        )}
      </ScrollView>
      <AuthModal visible={authVisible} onClose={() => setAuthVisible(false)} />
    </View>
  )
}

function SignedInProfile({
  user,
  token,
  autoOpenBadges,
  onUpdated,
  onLogout,
  styles,
}: {
  user: AuthUser
  token: string | null
  autoOpenBadges: boolean
  onUpdated: () => Promise<void>
  onLogout: () => void
  styles: ReturnType<typeof createStyles>
}) {
  const { text } = useI18n()
  const avatar = user.avatar ?? user.avatarUrl
  const location = [user.region, user.country].filter(Boolean).join(' · ')
  const level = user.level ?? 1
  const xp = user.xp ?? 0
  const mileage = user.availableMileagePoints ?? 0
  const activeBadge = findBadge(user.activeBadgeId)
  const [badgeSheetVisible, setBadgeSheetVisible] = useState(false)
  const [savingBadgeId, setSavingBadgeId] = useState<string | null>(null)
  const [badgeError, setBadgeError] = useState<string | null>(null)
  const [availableBadgeIds, setAvailableBadgeIds] = useState<string[] | null>(null)
  const [loadingBadges, setLoadingBadges] = useState(false)
  const [panel, setPanel] = useState<ProfilePanel | null>(null)
  const [settings, setSettings] = useState<LocalProfileSettings>(DEFAULT_PROFILE_SETTINGS)
  const [biometricTypes, setBiometricTypes] = useState<LocalAuthentication.AuthenticationType[]>([])
  const [savingMedia, setSavingMedia] = useState<MediaKind | null>(null)
  const [mediaEditor, setMediaEditor] = useState<MediaEditorState | null>(null)
  const [mediaActionKind, setMediaActionKind] = useState<MediaKind | null>(null)
  const [libraryPickerKind, setLibraryPickerKind] = useState<MediaKind | null>(null)

  useEffect(() => {
    let cancelled = false
    loadProfileSettings().then((next) => {
      if (!cancelled) setSettings(next)
    })
    LocalAuthentication.supportedAuthenticationTypesAsync()
      .then((types) => {
        if (!cancelled) setBiometricTypes(types)
      })
      .catch(() => {
        if (!cancelled) setBiometricTypes([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openBadgeSheet = useCallback(async () => {
    setBadgeSheetVisible(true)
    if (!token) return
    setLoadingBadges(true)
    setBadgeError(null)
    try {
      const response = await getMyBadgesApi(token)
      setAvailableBadgeIds(response.badges.map((badge) => badge.id))
    } catch {
      setBadgeError(text('徽章列表加载失败，请稍后再试。'))
      setAvailableBadgeIds(null)
    } finally {
      setLoadingBadges(false)
    }
  }, [text, token])

  useEffect(() => {
    if (!autoOpenBadges) return
    void openBadgeSheet()
  }, [autoOpenBadges, openBadgeSheet])

  const selectBadge = useCallback(async (badgeId: string | null) => {
    if (!token) return
    setSavingBadgeId(badgeId ?? 'none')
    setBadgeError(null)
    try {
      await setActiveBadgeApi(token, badgeId)
      await onUpdated()
      setBadgeSheetVisible(false)
    } catch {
      setBadgeError(text('徽章保存失败，请稍后再试。'))
    } finally {
      setSavingBadgeId(null)
    }
  }, [onUpdated, text, token])

  const persistSettings = useCallback(async (next: LocalProfileSettings) => {
    setSettings(next)
    await saveProfileSettings(next)
  }, [])

  const saveEditedMedia = useCallback(async (editedUri: string, kind: MediaKind) => {
    if (!token) return
    setSavingMedia(kind)
    try {
      const uploaded = await uploadProfileMediaApi(token, editedUri, kind)
      await updateProfileApi(token, kind === 'avatar' ? { avatar: uploaded.url } : { coverImage: uploaded.url })
      await onUpdated()
      setMediaEditor(null)
    } catch {
      Alert.alert(kind === 'avatar' ? text('头像保存失败') : text('背景保存失败'), text('请稍后再试。'))
    } finally {
      setSavingMedia(null)
    }
  }, [onUpdated, text, token])

  const pickFromCamera = useCallback(async (kind: MediaKind) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(text('无法使用相机'), text('请在系统设置中允许 LazyNavy 使用相机。'))
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.85,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset?.uri) return
    setMediaEditor({ kind, uri: asset.uri, width: asset.width, height: asset.height })
  }, [text])

  const pickProfileImage = useCallback(async (kind: MediaKind) => {
    if (!token) return
    setMediaActionKind(kind)
  }, [token])

  const openPickedAsset = useCallback(async (asset: MediaLibrary.Asset, kind: MediaKind) => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true })
      const uri = info.localUri ?? info.uri ?? asset.uri
      setLibraryPickerKind(null)
      setMediaEditor({ kind, uri, width: asset.width, height: asset.height })
    } catch {
      Alert.alert(text('读取图片失败'), text('请换一张图片再试。'))
    }
  }, [text])

  return (
    <>
      <Pressable style={styles.hero} onPress={() => void pickProfileImage('cover')} accessibilityRole="button" accessibilityLabel={text('上传背景')}>
        {user.coverImage ? (
          <Image source={{ uri: user.coverImage }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#0e7490', '#38bdf8', '#f8fafc']} style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.coverShade} />
        {savingMedia === 'cover' && (
          <View style={styles.mediaSavingPill}>
            <ActivityIndicator color="#123047" size="small" />
          </View>
        )}
        <View style={styles.profileHead}>
          <Pressable
            style={styles.avatar}
            onPress={(event: GestureResponderEvent) => {
              event.stopPropagation()
              void pickProfileImage('avatar')
            }}
            accessibilityRole="button"
            accessibilityLabel={text('上传头像')}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initial(user.nickname)}</Text>
            )}
            {savingMedia === 'avatar' && (
              <View style={styles.avatarSavingMask}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </Pressable>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>{user.nickname}</Text>
              {activeBadge && <Image source={activeBadge.image} style={styles.heroBadge} resizeMode="contain" />}
            </View>
            <Text numberOfLines={1} style={styles.meta}>{location || text('地区未设置')}</Text>
            <View style={styles.factRow}>
              <Text style={[styles.gender, { color: genderColor(user.gender) }]}>{genderIcon(user.gender)}</Text>
              <Text style={styles.fact}>{ageText(user.birthDate, text)}</Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={styles.body}>
        <Text style={styles.bio}>{user.bio?.trim() || text('还没有填写个人简介。')}</Text>

        <View style={styles.statsRow}>
          <Stat label={text('等级')} value={`Lv.${level}`} styles={styles} />
          <View style={styles.statDivider} />
          <Stat label={text('经验')} value={xp.toLocaleString()} styles={styles} />
          <View style={styles.statDivider} />
          <Stat label={text('里程点')} value={mileage.toLocaleString()} styles={styles} />
        </View>

        <View style={styles.infoPanel}>
          <MenuRow
            label={text('我的资料')}
            value={text('基本信息')}
            styles={styles}
            onPress={() => setPanel('profile')}
          />
          <MenuRow
            label={text('我的徽章')}
            value={activeBadge?.title ?? text('未佩戴')}
            accent={!!activeBadge}
            styles={styles}
            onPress={openBadgeSheet}
          />
          <MenuRow label={text('安全')} value={securitySummary(settings, text)} styles={styles} onPress={() => setPanel('security')} />
          <MenuRow label={text('界面设置')} value={appearanceSummary(settings, user, text)} styles={styles} onPress={() => setPanel('appearance')} />
          <MenuRow label={text('隐私设置')} value={privacySummary(settings, user, text)} styles={styles} onPress={() => setPanel('privacy')} />
        </View>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>{text('退出登录')}</Text>
        </Pressable>
        <Text style={styles.versionText}>LazyNavy V{Constants.expoConfig?.version ?? '0.0.1'}</Text>
      </View>
      <BadgeSheet
        visible={badgeSheetVisible}
        activeBadgeId={user.activeBadgeId ?? null}
        availableBadgeIds={availableBadgeIds}
        loading={loadingBadges}
        savingBadgeId={savingBadgeId}
        error={badgeError}
        styles={styles}
        onClose={() => setBadgeSheetVisible(false)}
        onSelect={selectBadge}
      />
      <SettingsSheet
        visible={panel !== null}
        panel={panel}
        user={user}
        token={token}
        settings={settings}
        biometricTypes={biometricTypes}
        styles={styles}
        onClose={() => setPanel(null)}
        onUpdated={onUpdated}
        onSaveSettings={persistSettings}
      />
      <MediaCropSheet
        media={mediaEditor}
        saving={savingMedia !== null}
        styles={styles}
        onClose={() => setMediaEditor(null)}
        onSave={(uri, kind) => void saveEditedMedia(uri, kind)}
      />
      <PhotoLibrarySheet
        kind={libraryPickerKind}
        styles={styles}
        onClose={() => setLibraryPickerKind(null)}
        onSelect={(asset, kind) => void openPickedAsset(asset, kind)}
      />
      <ImageSourceActionSheet
        visible={mediaActionKind !== null}
        title={mediaActionKind === 'avatar' ? text('更换头像') : text('更换背景')}
        onClose={() => setMediaActionKind(null)}
        onCamera={() => {
          if (mediaActionKind) void pickFromCamera(mediaActionKind)
        }}
        onLibrary={() => {
          if (mediaActionKind) setLibraryPickerKind(mediaActionKind)
        }}
      />
    </>
  )
}

function GuestProfile({ onLogin, styles }: { onLogin: () => void; styles: ReturnType<typeof createStyles> }) {
  const { text } = useI18n()
  return (
    <View style={styles.guestCard}>
      <View style={styles.guestAvatar}>
        <Text style={styles.guestAvatarText}>◎</Text>
      </View>
      <Text style={styles.guestTitle}>{text('登录后查看我的资料')}</Text>
      <Text style={styles.guestSubtitle}>{text('同步你的头像、昵称和账号信息，之后这里会承接 v2 的个人资料展示。')}</Text>
      <Pressable style={styles.loginButton} onPress={onLogin}>
        <Text style={styles.loginButtonText}>{text('登录 / 注册')}</Text>
      </Pressable>
    </View>
  )
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.statItem}>
      <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function MenuRow({
  label,
  value,
  accent,
  styles,
  onPress,
}: {
  label: string
  value: string
  accent?: boolean
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  return (
    <Pressable style={styles.infoRow} onPress={onPress}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.menuValueWrap}>
        <Text numberOfLines={1} style={[styles.infoValue, accent && styles.infoValueAccent]}>{value}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  )
}

function PhotoLibrarySheet({
  kind,
  styles,
  onClose,
  onSelect,
}: {
  kind: MediaKind | null
  styles: ReturnType<typeof createStyles>
  onClose: () => void
  onSelect: (asset: MediaLibrary.Asset, kind: MediaKind) => void
}) {
  const { text } = useI18n()
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [access, setAccess] = useState<'all' | 'limited' | 'none'>('none')
  const photoItems = access === 'limited' ? [...assets, 'add-more' as const] : assets

  const loadAssets = useCallback(async (showLoading = true) => {
    if (!kind) return
    if (showLoading) setLoading(true)
    try {
      const permission = await MediaLibrary.getPermissionsAsync(false, ['photo'])
      const nextAccess = permission.accessPrivileges ?? (permission.granted ? 'all' : 'none')
      setAccess(nextAccess)
      if (!permission.granted || nextAccess === 'none') {
        setAssets([])
        return
      }
      const page = await MediaLibrary.getAssetsAsync({
        first: 90,
        mediaType: [MediaLibrary.MediaType.photo],
        sortBy: [MediaLibrary.SortBy.creationTime],
      })
      setAssets(page.assets)
    } catch {
      setAssets([])
      Alert.alert(text('相册加载失败'), text('请稍后再试。'))
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [kind, onClose, text])

  useEffect(() => {
    if (!kind) return
    void loadAssets()
  }, [kind, loadAssets])

  useEffect(() => {
    if (!kind) return
    const subscription = MediaLibrary.addListener(() => {
      void loadAssets(false)
    })
    return () => {
      subscription.remove()
    }
  }, [kind, loadAssets])

  async function chooseMore() {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(['photo'])
      await refreshAfterPermissionChange(loadAssets)
    } catch {
      Alert.alert(text('无法打开照片权限选择'), text('请在系统设置中调整 LazyNavy 的照片访问权限。'))
    }
  }

  if (!kind) return null

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.photoPickerScreen}>
        <View style={styles.photoPickerHeader}>
          <Pressable style={styles.photoPickerHeaderButton} onPress={onClose}>
            <Text style={styles.photoPickerHeaderText}>{text('取消')}</Text>
          </Pressable>
          <Text style={styles.photoPickerTitle}>{text('选择照片')}</Text>
          <View style={styles.photoPickerHeaderButton} />
        </View>
        {loading ? (
          <View style={styles.photoPickerLoading}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : access === 'none' ? (
          <View style={styles.photoPermissionEmpty}>
            <Text style={styles.photoPermissionTitle}>{text('无法访问相册中的照片')}</Text>
            <Text style={styles.photoPermissionText}>{text('请在系统设置中允许 LazyNavy 访问照片，或选择有限照片访问。')}</Text>
            <Pressable style={styles.photoPermissionButton} onPress={() => void Linking.openSettings()}>
              <Text style={styles.photoPermissionButtonText}>{text('去设置')}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={photoItems}
            keyExtractor={(item) => item === 'add-more' ? 'add-more' : item.id}
            numColumns={3}
            contentContainerStyle={styles.photoGrid}
            ListEmptyComponent={<Text style={styles.photoEmptyText}>{text('没有可访问的照片')}</Text>}
            renderItem={({ item }) => (
              item === 'add-more' ? (
                <Pressable style={[styles.photoTile, styles.photoMoreTile]} onPress={() => void chooseMore()}>
                  <Text style={styles.photoMorePlus}>＋</Text>
                  <Text style={styles.photoMoreTileText}>{text('添加更多')}</Text>
                  <Text style={styles.photoMoreTileText}>{text('可访问照片')}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.photoTile} onPress={() => onSelect(item, kind)}>
                  <Image source={{ uri: item.uri }} style={styles.photoTileImage} resizeMode="cover" />
                </Pressable>
              )
            )}
          />
        )}
      </View>
    </Modal>
  )
}

function MediaCropSheet({
  media,
  saving,
  styles,
  onClose,
  onSave,
}: {
  media: MediaEditorState | null
  saving: boolean
  styles: ReturnType<typeof createStyles>
  onClose: () => void
  onSave: (uri: string, kind: MediaKind) => void
}) {
  const { text } = useI18n()
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const offsetRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const gestureStartRef = useRef({
    center: { x: 0, y: 0 },
    distance: 0,
    offset: { x: 0, y: 0 },
    zoom: 1,
  })

  useEffect(() => {
    if (!media) return
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    zoomRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
  }, [media])

  const usableWidth = Math.max(0, stageSize.width - 32)
  const usableHeight = Math.max(0, stageSize.height - 160)
  const frameWidth = media?.kind === 'avatar'
    ? Math.min(usableWidth, usableHeight, 340)
    : Math.min(usableWidth, usableHeight * 16 / 9, 440)
  const frameHeight = media?.kind === 'avatar' ? frameWidth : frameWidth * 9 / 16
  const scale = media && frameWidth > 0 ? coverScale(media.width, media.height, frameWidth, frameHeight) * zoom : 1
  const displayWidth = media ? media.width * scale : 0
  const displayHeight = media ? media.height * scale : 0

  const applyOffset = useCallback((nextOffset: { x: number; y: number }, nextZoom = zoomRef.current) => {
    if (!media || frameWidth <= 0) return nextOffset
    const nextScale = coverScale(media.width, media.height, frameWidth, frameHeight) * nextZoom
    const nextDisplayWidth = media.width * nextScale
    const nextDisplayHeight = media.height * nextScale
    const clamped = {
      x: clamp(nextOffset.x, -Math.max(0, (nextDisplayWidth - frameWidth) / 2), Math.max(0, (nextDisplayWidth - frameWidth) / 2)),
      y: clamp(nextOffset.y, -Math.max(0, (nextDisplayHeight - frameHeight) / 2), Math.max(0, (nextDisplayHeight - frameHeight) / 2)),
    }
    offsetRef.current = clamped
    setOffset(clamped)
    return clamped
  }, [frameHeight, frameWidth, media])

  const applyZoom = useCallback((nextZoom: number, nextOffset = offsetRef.current) => {
    const clampedZoom = clamp(nextZoom, 1, 4)
    zoomRef.current = clampedZoom
    setZoom(clampedZoom)
    applyOffset(nextOffset, clampedZoom)
  }, [applyOffset])

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches
      gestureStartRef.current = {
        center: touchCenter(touches),
        distance: touchDistance(touches),
        offset: offsetRef.current,
        zoom: zoomRef.current,
      }
    },
    onPanResponderMove: (event) => {
      const touches = event.nativeEvent.touches
      const center = touchCenter(touches)
      const start = gestureStartRef.current
      const nextOffset = {
        x: start.offset.x + center.x - start.center.x,
        y: start.offset.y + center.y - start.center.y,
      }
      if (touches.length >= 2 && start.distance > 0) {
        applyZoom(start.zoom * (touchDistance(touches) / start.distance), nextOffset)
        return
      }
      applyOffset(nextOffset)
    },
  }), [applyOffset, applyZoom])

  if (!media) return null

  async function saveCrop() {
    if (!media || frameWidth <= 0) return
    const crop = cropRectForFrame(media, frameWidth, frameHeight, zoom, offset)
    try {
      const result = await ImageManipulator.manipulateAsync(
        media.uri,
        [{ crop }],
        { compress: media.kind === 'avatar' ? 0.86 : 0.82, format: ImageManipulator.SaveFormat.JPEG },
      )
      onSave(result.uri, media.kind)
    } catch {
      Alert.alert(text('裁剪失败'), text('请换一张图片再试。'))
    }
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.cropFullscreen}>
        <View style={styles.cropTopBar}>
          <Pressable style={styles.cropTopButton} onPress={onClose}>
            <Text style={styles.cropTopButtonText}>{text('取消')}</Text>
          </Pressable>
          <Text style={styles.cropTopTitle}>{media.kind === 'avatar' ? text('调整头像') : text('调整背景')}</Text>
          <Pressable style={styles.cropTopButton} onPress={() => void saveCrop()} disabled={saving}>
            <Text style={styles.cropTopButtonText}>{saving ? text('保存中') : text('保存')}</Text>
          </Pressable>
        </View>

        <View
          style={styles.cropFullscreenStage}
          onLayout={(event: LayoutChangeEvent) => setStageSize(event.nativeEvent.layout)}
        >
          <View
            style={[
              styles.cropFrame,
              media.kind === 'avatar' ? styles.cropFrameAvatar : styles.cropFrameCover,
              { width: frameWidth, height: frameHeight },
            ]}
            {...panResponder.panHandlers}
          >
            <Image
              source={{ uri: media.uri }}
              style={[
                styles.cropImage,
                {
                  width: displayWidth,
                  height: displayHeight,
                  left: (frameWidth - displayWidth) / 2 + offset.x,
                  top: (frameHeight - displayHeight) / 2 + offset.y,
                },
              ]}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.cropHint}>{text('双指缩放，拖动调整位置')}</Text>
        </View>
      </View>
    </Modal>
  )
}

function SettingsSheet({
  visible,
  panel,
  user,
  token,
  settings,
  biometricTypes,
  styles,
  onClose,
  onUpdated,
  onSaveSettings,
}: {
  visible: boolean
  panel: ProfilePanel | null
  user: AuthUser
  token: string | null
  settings: LocalProfileSettings
  biometricTypes: LocalAuthentication.AuthenticationType[]
  styles: ReturnType<typeof createStyles>
  onClose: () => void
  onUpdated: () => Promise<void>
  onSaveSettings: (settings: LocalProfileSettings) => Promise<void>
}) {
  const { setLocale, text } = useI18n()
  const [draft, setDraft] = useState<Partial<AuthUser>>({})
  const [localDraft, setLocalDraft] = useState<LocalProfileSettings>(settings)
  const [disableProtectionPassword, setDisableProtectionPassword] = useState('')
  const [birthPickerVisible, setBirthPickerVisible] = useState(false)
  const [countryPickerVisible, setCountryPickerVisible] = useState(false)
  const [languagePicker, setLanguagePicker] = useState<LanguagePickerKind | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    setDraft({
      nickname: user.nickname,
      bio: user.bio ?? '',
      gender: user.gender ?? 'private',
      birthDate: user.birthDate ?? '',
      country: user.country ?? '',
      region: user.region ?? '',
      firstLanguage: user.firstLanguage ?? '',
      textLanguage: user.textLanguage ?? '',
      uiLanguage: user.uiLanguage ?? settings.uiLanguage,
      sailingYears: user.sailingYears ?? 0,
      isPublic: user.isPublic ?? true,
      locationPolicy: user.locationPolicy ?? 'region',
    })
    setLocalDraft({
      ...settings,
      speechLanguage: user.textLanguage ?? settings.speechLanguage,
      uiLanguage: user.uiLanguage ?? settings.uiLanguage,
    })
    setDisableProtectionPassword('')
  }, [settings, user, visible])

  if (!panel) return null

  const title = {
    profile: text('我的资料'),
    security: text('安全'),
    appearance: text('界面设置'),
    privacy: text('隐私设置'),
  }[panel]
  const hasFace = biometricTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  const hasFingerprint = biometricTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)

  async function save() {
    if (!token) return
    setSaving(true)
    try {
      if (panel === 'profile') {
        await updateProfileApi(token, {
          nickname: String(draft.nickname ?? user.nickname).trim() || user.nickname,
          bio: String(draft.bio ?? ''),
          gender: draft.gender,
          birthDate: normalizeBirthDateForApi(draft.birthDate),
          country: normalizeEmpty(draft.country),
          region: normalizeEmpty(draft.region),
          firstLanguage: normalizeEmpty(draft.firstLanguage),
          sailingYears: Number(draft.sailingYears ?? 0),
        })
        await onUpdated()
      }
      if (panel === 'appearance') {
        await onSaveSettings(localDraft)
        await updateProfileApi(token, {
          uiLanguage: localDraft.uiLanguage,
          textLanguage: localDraft.speechLanguage,
        })
        setLocale(localDraft.uiLanguage)
        await onUpdated()
      }
      if (panel === 'privacy') {
        await onSaveSettings(localDraft)
        await updateProfileApi(token, {
          isPublic: draft.isPublic,
          locationPolicy: draft.locationPolicy,
        })
        await onUpdated()
      }
      if (panel === 'security') {
        if (localDraft.appLockEnabled && localDraft.appLockPassword.trim().length === 0) {
          Alert.alert(text('需要保护密码'), text('开启保护时请先设置保护密码。'))
          return
        }
        if (settings.appLockEnabled && !localDraft.appLockEnabled && disableProtectionPassword !== settings.appLockPassword) {
          Alert.alert(text('密码不正确'), text('解除保护需要输入当前保护密码。'))
          return
        }
        await onSaveSettings({
          ...localDraft,
          appLockPassword: localDraft.appLockEnabled ? localDraft.appLockPassword : '',
          faceUnlockEnabled: localDraft.appLockEnabled ? localDraft.faceUnlockEnabled : false,
          fingerprintUnlockEnabled: localDraft.appLockEnabled ? localDraft.fingerprintUnlockEnabled : false,
        })
      }
      onClose()
    } catch {
      Alert.alert(text('保存失败'), text('请检查填写内容后再试。'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.settingsScreen}>
        <View style={styles.settingsNav}>
          <Pressable style={styles.settingsNavButton} onPress={onClose}>
            <Text style={styles.settingsNavButtonText}>{text('取消')}</Text>
          </Pressable>
          <Text style={styles.settingsNavTitle}>{title}</Text>
          <Pressable style={styles.settingsNavButton} onPress={() => void save()} disabled={saving}>
            <Text style={[styles.settingsNavButtonText, saving && styles.settingsNavButtonDisabled]}>{saving ? text('保存中') : text('完成')}</Text>
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsContent}>
          {panel === 'profile' && (
            <>
              <SettingsGroup styles={styles}>
                <Field label={text('昵称')} value={String(draft.nickname ?? '')} styles={styles} onChangeText={(nickname) => setDraft((d) => ({ ...d, nickname }))} />
                <BirthdayField value={String(draft.birthDate ?? '')} styles={styles} onPress={() => setBirthPickerVisible(true)} />
                <CountryRegionField
                  country={String(draft.country ?? '')}
                  region={String(draft.region ?? '')}
                  styles={styles}
                  onPress={() => setCountryPickerVisible(true)}
                />
              </SettingsGroup>
              <SettingsGroup styles={styles}>
                <Segment label={text('性别')} value={String(draft.gender ?? 'private')} options={[['private', text('保密')], ['male', text('男')], ['female', text('女')]]} styles={styles} onChange={(gender) => setDraft((d) => ({ ...d, gender }))} />
              </SettingsGroup>
              <SettingsGroup styles={styles}>
                <Field label={text('个人简介')} value={String(draft.bio ?? '')} multiline styles={styles} onChangeText={(bio) => setDraft((d) => ({ ...d, bio }))} />
              </SettingsGroup>
            </>
          )}
          {panel === 'security' && (
            <>
              <SettingsGroup styles={styles}>
                <Segment label="2FA" value={localDraft.twoFactorMethod} options={[['off', text('关闭 2FA')], ['email', text('邮箱')], ['authenticator', text('验证器')]]} styles={styles} onChange={(twoFactorMethod) => setLocalDraft((d) => ({ ...d, twoFactorMethod: twoFactorMethod as LocalProfileSettings['twoFactorMethod'] }))} />
              </SettingsGroup>
              <SettingsGroup styles={styles}>
                <SettingToggle label={text('后台打开需要保护密码')} value={localDraft.appLockEnabled} styles={styles} onValueChange={(appLockEnabled) => setLocalDraft((d) => ({ ...d, appLockEnabled }))} />
                {localDraft.appLockEnabled ? (
                  <Field label={text('保护密码')} value={localDraft.appLockPassword} secureTextEntry styles={styles} onChangeText={(appLockPassword) => setLocalDraft((d) => ({ ...d, appLockPassword }))} />
                ) : settings.appLockEnabled ? (
                  <Field label={text('当前保护密码')} value={disableProtectionPassword} secureTextEntry styles={styles} onChangeText={setDisableProtectionPassword} />
                ) : null}
                <SettingToggle label={text('面部解锁')} value={localDraft.appLockEnabled && localDraft.faceUnlockEnabled && hasFace} disabled={!localDraft.appLockEnabled || !hasFace} styles={styles} onValueChange={(faceUnlockEnabled) => setLocalDraft((d) => ({ ...d, faceUnlockEnabled }))} />
                <SettingToggle label={text('指纹解锁')} value={localDraft.appLockEnabled && localDraft.fingerprintUnlockEnabled && hasFingerprint} disabled={!localDraft.appLockEnabled || !hasFingerprint} styles={styles} onValueChange={(fingerprintUnlockEnabled) => setLocalDraft((d) => ({ ...d, fingerprintUnlockEnabled }))} />
              </SettingsGroup>
              <InfoNote text={text('修改密码入口已预留，后端密码修改接口接入后会从这里进入。')} styles={styles} />
            </>
          )}
          {panel === 'appearance' && (
            <>
              <SettingsGroup styles={styles}>
                <Segment label={text('颜色主题')} value={localDraft.colorTheme} options={[['ocean', text('海洋')], ['light', text('浅色')], ['dark', text('深色')], ['system', text('跟随系统')]]} styles={styles} onChange={(colorTheme) => setLocalDraft((d) => ({ ...d, colorTheme: colorTheme as LocalProfileSettings['colorTheme'] }))} />
              </SettingsGroup>
              <SettingsGroup styles={styles}>
                <LanguageField
                  label={text('说话语言')}
                  value={languageLabel(SPEECH_LANGUAGE_OPTIONS, localDraft.speechLanguage)}
                  placeholder={text('选择说话语言')}
                  styles={styles}
                  onPress={() => setLanguagePicker('speech')}
                />
                <LanguageField
                  label={text('界面语言')}
                  value={languageLabel(UI_LANGUAGE_OPTIONS, localDraft.uiLanguage)}
                  placeholder={text('选择界面语言')}
                  styles={styles}
                  onPress={() => setLanguagePicker('ui')}
                />
              </SettingsGroup>
            </>
          )}
          {panel === 'privacy' && (
            <>
              <SettingsGroup styles={styles}>
                <Segment label={text('谁能看我')} value={localDraft.whoCanViewMe} options={[['everyone', text('所有人')], ['friends', text('好友')], ['crew', text('船员')], ['private', text('仅自己')]]} styles={styles} onChange={(whoCanViewMe) => setLocalDraft((d) => ({ ...d, whoCanViewMe: whoCanViewMe as LocalProfileSettings['whoCanViewMe'] }))} />
                <Segment label={text('谁能加我')} value={localDraft.whoCanAddMe} options={[['everyone', text('所有人')], ['friends', text('好友')], ['crew', text('船员')], ['private', text('关闭')]]} styles={styles} onChange={(whoCanAddMe) => setLocalDraft((d) => ({ ...d, whoCanAddMe: whoCanAddMe as LocalProfileSettings['whoCanAddMe'] }))} />
              </SettingsGroup>
              <SettingsGroup styles={styles}>
                <SettingToggle label={text('允许被搜索到')} value={localDraft.searchable} styles={styles} onValueChange={(searchable) => setLocalDraft((d) => ({ ...d, searchable }))} />
                <SettingToggle label={text('公开资料页')} value={!!draft.isPublic} styles={styles} onValueChange={(isPublic) => setDraft((d) => ({ ...d, isPublic }))} />
                <Segment label={text('位置展示')} value={String(draft.locationPolicy ?? 'region')} options={[['exact', text('精确')], ['region', text('地区')], ['hidden', text('隐藏')]]} styles={styles} onChange={(locationPolicy) => setDraft((d) => ({ ...d, locationPolicy }))} />
              </SettingsGroup>
              <SettingsGroup styles={styles}>
                {(['avatar', 'bio', 'region', 'badges'] as const).map((field) => (
                  <SettingToggle
                    key={field}
                    label={visibleFieldLabel(field, text)}
                    value={localDraft.visibleFields.includes(field)}
                    styles={styles}
                    onValueChange={(enabled) => setLocalDraft((d) => ({ ...d, visibleFields: toggleItem(d.visibleFields, field, enabled) }))}
                  />
                ))}
              </SettingsGroup>
            </>
          )}
        </ScrollView>
        {panel === 'profile' && (
          <>
            <BirthDatePicker
              visible={birthPickerVisible}
              value={String(draft.birthDate ?? '')}
              styles={styles}
              onClose={() => setBirthPickerVisible(false)}
              onPrivate={() => setDraft((d) => ({ ...d, birthDate: PRIVATE_BIRTH_DATE }))}
              onChange={(birthDate) => setDraft((d) => ({ ...d, birthDate }))}
            />
            <CountryRegionPicker
              visible={countryPickerVisible}
              country={String(draft.country ?? '')}
              region={String(draft.region ?? '')}
              onClose={() => setCountryPickerVisible(false)}
              onChange={({ country, region }) => setDraft((d) => ({ ...d, country, region }))}
            />
          </>
        )}
        {panel === 'appearance' && (
          <LanguagePicker
            kind={languagePicker}
            speechValue={localDraft.speechLanguage}
            uiValue={localDraft.uiLanguage}
            title={languagePicker === 'speech' ? text('选择说话语言') : text('选择界面语言')}
            cancelLabel={text('取消')}
            styles={styles}
            onClose={() => setLanguagePicker(null)}
            onSelect={(value) => {
              if (languagePicker === 'speech') {
                setLocalDraft((d) => ({ ...d, speechLanguage: value }))
              } else {
                setLocalDraft((d) => ({ ...d, uiLanguage: value }))
              }
              setLanguagePicker(null)
            }}
          />
        )}
      </View>
    </Modal>
  )
}

function SettingsGroup({ children, styles }: {
  children: ReactNode
  styles: ReturnType<typeof createStyles>
}) {
  return <View style={styles.settingsGroup}>{children}</View>
}

function Field({ label, value, placeholder, multiline, secureTextEntry, styles, onChangeText }: {
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
  secureTextEntry?: boolean
  styles: ReturnType<typeof createStyles>
  onChangeText: (value: string) => void
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder ?? label}
        placeholderTextColor="#8aa0ad"
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline && styles.inputMultiline]}
        onChangeText={onChangeText}
      />
    </View>
  )
}

function BirthdayField({ value, styles, onPress }: {
  value: string
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  const { text } = useI18n()
  const displayValue = formatBirthDateDisplay(value)
  const privateDate = isPrivateBirthDate(value)
  return (
    <Pressable style={styles.fieldWrap} onPress={onPress}>
      <Text style={styles.fieldLabel}>{text('生日')}</Text>
      <Text style={[styles.dateValue, !displayValue && !privateDate && styles.datePlaceholder]}>{privateDate ? text('保密') : displayValue || text('选择日期')}</Text>
      <Text style={styles.settingsChevron}>›</Text>
    </Pressable>
  )
}

function CountryRegionField({ country, region, styles, onPress }: {
  country: string
  region: string
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  const { text } = useI18n()
  const value = [country, region].filter(Boolean).join(' · ')
  return (
    <Pressable style={styles.fieldWrap} onPress={onPress}>
      <Text style={styles.fieldLabel}>{text('国家和地区')}</Text>
      <Text style={[styles.dateValue, !value && styles.datePlaceholder]}>{value || text('选择国家和地区')}</Text>
      <Text style={styles.settingsChevron}>›</Text>
    </Pressable>
  )
}

function LanguageField({ label, value, placeholder, styles, onPress }: {
  label: string
  value: string
  placeholder: string
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  const { text } = useI18n()
  return (
    <Pressable style={styles.fieldWrap} onPress={onPress}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.dateValue, !value && styles.datePlaceholder]}>{value || placeholder}</Text>
      <Text style={styles.settingsChevron}>›</Text>
    </Pressable>
  )
}

function LanguagePicker({
  kind,
  speechValue,
  uiValue,
  title,
  cancelLabel,
  styles,
  onClose,
  onSelect,
}: {
  kind: LanguagePickerKind | null
  speechValue: string
  uiValue: string
  title: string
  cancelLabel: string
  styles: ReturnType<typeof createStyles>
  onClose: () => void
  onSelect: (value: string) => void
}) {
  if (!kind) return null

  const options = kind === 'speech' ? SPEECH_LANGUAGE_OPTIONS : UI_LANGUAGE_OPTIONS
  const selectedValue = kind === 'speech' ? speechValue : uiValue

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.datePickerLayer}>
        <Pressable style={styles.datePickerBackdrop} onPress={onClose} />
        <View style={styles.languagePickerSheet}>
          <View style={styles.datePickerToolbar}>
            <Pressable style={styles.datePickerToolbarButton} onPress={onClose}>
              <Text style={styles.datePickerClearText}>{cancelLabel}</Text>
            </Pressable>
            <Text style={styles.datePickerTitle}>{title}</Text>
            <View style={styles.datePickerToolbarButton} />
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.languageOptionList}
            renderItem={({ item }) => {
              const selected = item.value === selectedValue
              return (
                <Pressable style={styles.languageOption} onPress={() => onSelect(item.value)}>
                  <View style={styles.languageOptionTextWrap}>
                    <Text style={styles.languageOptionLabel}>{item.label}</Text>
                    <Text style={styles.languageOptionDetail}>{item.detail}</Text>
                  </View>
                  <Text style={[styles.languageOptionCheck, selected && styles.languageOptionCheckActive]}>{selected ? '✓' : ''}</Text>
                </Pressable>
              )
            }}
          />
        </View>
      </View>
    </Modal>
  )
}

function BirthDatePicker({ visible, value, styles, onClose, onPrivate, onChange }: {
  visible: boolean
  value: string
  styles: ReturnType<typeof createStyles>
  onClose: () => void
  onPrivate: () => void
  onChange: (value: string) => void
}) {
  const { locale, text } = useI18n()
  const [selectedDate, setSelectedDate] = useState(dateFromBirthValue(value))

  useEffect(() => {
    if (!visible) return
    setSelectedDate(dateFromBirthValue(value))
  }, [value, visible])

  function confirm() {
    onChange(formatBirthDate(selectedDate))
    onClose()
  }

  function setPrivate() {
    onPrivate()
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.datePickerLayer}>
        <Pressable style={styles.datePickerBackdrop} onPress={onClose} />
        <View style={styles.datePickerSheet}>
          <View style={styles.datePickerToolbar}>
            <Pressable style={styles.datePickerToolbarButton} onPress={setPrivate}>
              <Text style={styles.datePickerClearText}>{text('保密')}</Text>
            </Pressable>
            <Text style={styles.datePickerTitle}>{text('选择生日')}</Text>
            <Pressable style={styles.datePickerToolbarButton} onPress={confirm}>
              <Text style={styles.datePickerDoneText}>{text('完成')}</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            locale={locale === 'zh-CN' ? 'zh-Hans' : locale}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
            onChange={(_, date) => {
              if (date) setSelectedDate(date)
            }}
            style={styles.datePicker}
          />
        </View>
      </View>
    </Modal>
  )
}

function Segment({ label, value, options, styles, onChange }: {
  label: string
  value: string
  options: [string, string][]
  styles: ReturnType<typeof createStyles>
  onChange: (value: string) => void
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.segmentRow}>
        {options.map(([key, text]) => {
          const active = value === key
          return (
            <Pressable key={key} style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={() => onChange(key)}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{text}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function SettingToggle({ label, value, disabled, styles, onValueChange }: {
  label: string
  value: boolean
  disabled?: boolean
  styles: ReturnType<typeof createStyles>
  onValueChange: (value: boolean) => void
}) {
  const { text } = useI18n()
  return (
    <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
      <Text style={styles.toggleLabel}>{label}{disabled ? text('（不支持）') : ''}</Text>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} />
    </View>
  )
}

function InfoNote({ text, styles }: { text: string; styles: ReturnType<typeof createStyles> }) {
  return <Text style={styles.infoNote}>{text}</Text>
}

function BadgeSheet({
  visible,
  activeBadgeId,
  availableBadgeIds,
  loading,
  savingBadgeId,
  error,
  styles,
  onClose,
  onSelect,
}: {
  visible: boolean
  activeBadgeId: string | null
  availableBadgeIds: string[] | null
  loading: boolean
  savingBadgeId: string | null
  error: string | null
  styles: ReturnType<typeof createStyles>
  onClose: () => void
  onSelect: (badgeId: string | null) => Promise<void>
}) {
  const { text } = useI18n()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.badgeModalLayer}>
        <Pressable style={styles.badgeBackdrop} onPress={onClose} />
        <View style={styles.badgeSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.badgeSheetHeader}>
            <View>
              <Text style={styles.badgeSheetTitle}>{text('我的徽章')}</Text>
              <Text style={styles.badgeSheetSubtitle}>{text('选择一个已启用徽章展示在资料和需要露出的地方。')}</Text>
            </View>
            <Pressable style={styles.sheetClose} onPress={onClose}><Text style={styles.sheetCloseText}>×</Text></Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.badgeList}>
            <BadgeCategory title={text('系统成就徽章')} caption={text('当前开放')} />
            {loading && <Text style={styles.badgeLoading}>{text('正在同步徽章列表...')}</Text>}
            <View style={styles.badgeGrid}>
              {SYSTEM_BADGE_CATALOG.filter((badge) => !availableBadgeIds || availableBadgeIds.includes(badge.id)).map((badge) => (
                <BadgeOption
                  key={badge.id}
                  badge={badge}
                  active={activeBadgeId === badge.id}
                  saving={savingBadgeId === badge.id}
                  styles={styles}
                  onPress={() => void onSelect(badge.id)}
                />
              ))}
            </View>

            <Pressable style={styles.clearBadgeButton} onPress={() => void onSelect(null)} disabled={savingBadgeId === 'none'}>
              <Text style={styles.clearBadgeText}>{savingBadgeId === 'none' ? text('保存中...') : text('不佩戴徽章')}</Text>
            </Pressable>

            {error && <Text style={styles.badgeError}>{error}</Text>}

            <BadgeCategory title={text('用户自定义徽章')} caption={text('上传与后台审批后开放')} muted />
            <BadgeCategory title={text('组织徽章')} caption={text('组织、旗帜和多人体系后续接入')} muted />
            <BadgeCategory title={text('特殊徽章')} caption={text('粉丝会、奖励和活动徽章会逐步加入')} muted />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function BadgeCategory({ title, caption, muted }: { title: string; caption: string; muted?: boolean }) {
  return (
    <View style={{ marginTop: muted ? 14 : 0, marginBottom: 10 }}>
      <Text style={{ color: muted ? '#7c8a96' : '#123047', fontSize: 15, fontWeight: '900' }}>{title}</Text>
      <Text style={{ color: muted ? '#9aa8b4' : '#5f7d90', fontSize: 12, fontWeight: '600', marginTop: 3 }}>{caption}</Text>
    </View>
  )
}

function BadgeOption({
  badge,
  active,
  saving,
  styles,
  onPress,
}: {
  badge: BadgeCatalogItem
  active: boolean
  saving: boolean
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  const { text } = useI18n()
  return (
    <Pressable style={[styles.badgeOption, active && styles.badgeOptionActive]} onPress={onPress} disabled={saving}>
      <Image source={badge.image} style={styles.badgeOptionImage} resizeMode="contain" />
      <Text numberOfLines={2} style={styles.badgeOptionTitle}>{badge.title}</Text>
      <View style={[styles.badgeState, active && styles.badgeStateActive]}>
        <Text style={[styles.badgeStateText, active && styles.badgeStateTextActive]}>{saving ? text('保存中') : active ? text('佩戴中') : text('选择')}</Text>
      </View>
    </Pressable>
  )
}

function initial(name?: string | null) {
  return (name?.trim().slice(0, 1) || '我').toUpperCase()
}

function genderIcon(gender?: string | null) {
  if (gender === 'male') return '♂'
  if (gender === 'female') return '♀'
  return '○'
}

function genderColor(gender?: string | null) {
  if (gender === 'male') return '#38bdf8'
  if (gender === 'female') return '#f472b6'
  return 'rgba(255,255,255,0.78)'
}

function ageText(birthDate?: string | null, text: SourceTextFn = (source) => source) {
  const age = calculateAge(birthDate)
  return age === null ? text('年龄保密') : text('{age} 岁', { age })
}

function normalizeEmpty(value: unknown) {
  const clean = String(value ?? '').trim()
  return clean.length > 0 ? clean : null
}

function normalizeBirthDateForApi(value: unknown) {
  const displayDate = formatBirthDateDisplay(String(value ?? '').trim())
  if (displayDate) return displayDate
  return PRIVATE_BIRTH_DATE
}

function getImageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject)
  })
}

function coverScale(imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number) {
  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight)
}

function cropRectForFrame(media: MediaEditorState, frameWidth: number, frameHeight: number, zoom: number, offset: { x: number; y: number }) {
  const scale = coverScale(media.width, media.height, frameWidth, frameHeight) * zoom
  const displayWidth = media.width * scale
  const displayHeight = media.height * scale
  const imageLeft = (frameWidth - displayWidth) / 2 + offset.x
  const imageTop = (frameHeight - displayHeight) / 2 + offset.y
  const cropWidth = Math.min(media.width, frameWidth / scale)
  const cropHeight = Math.min(media.height, frameHeight / scale)
  const originX = clamp(-imageLeft / scale, 0, Math.max(0, media.width - cropWidth))
  const originY = clamp(-imageTop / scale, 0, Math.max(0, media.height - cropHeight))
  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  }
}

function touchCenter(touches: Array<{ pageX: number; pageY: number }>) {
  if (touches.length === 0) return { x: 0, y: 0 }
  const total = touches.reduce((sum, touch) => ({ x: sum.x + touch.pageX, y: sum.y + touch.pageY }), { x: 0, y: 0 })
  return { x: total.x / touches.length, y: total.y / touches.length }
}

function touchDistance(touches: Array<{ pageX: number; pageY: number }>) {
  if (touches.length < 2) return 0
  const [a, b] = touches
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

async function refreshAfterPermissionChange(loadAssets: (showLoading?: boolean) => Promise<void>) {
  await loadAssets(false)
  await delay(250)
  await loadAssets(false)
  await delay(700)
  await loadAssets(false)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toggleItem(items: string[], item: string, enabled: boolean) {
  if (enabled) return items.includes(item) ? items : [...items, item]
  return items.filter((current) => current !== item)
}

function visibleFieldLabel(field: string, text: SourceTextFn = (source) => source) {
  const labels: Record<string, string> = {
    avatar: '头像可见',
    bio: '简介可见',
    region: '地区可见',
    badges: '徽章可见',
  }
  return labels[field] ? text(labels[field]) : field
}

function securitySummary(settings: LocalProfileSettings, text: SourceTextFn = (source) => source) {
  if (settings.appLockEnabled) return text('已开启保护')
  if (settings.twoFactorMethod !== 'off') return text('2FA 已设置')
  return text('未设置')
}

function appearanceSummary(settings: LocalProfileSettings, user: AuthUser, text: SourceTextFn = (source) => source) {
  return languageLabel(UI_LANGUAGE_OPTIONS, user.uiLanguage || settings.uiLanguage) || text('默认')
}

function languageLabel(options: ReadonlyArray<{ value: string; label: string }>, value?: string | null) {
  const clean = String(value ?? '').trim()
  if (!clean) return ''
  return options.find((option) => option.value === clean)?.label ?? clean
}

function privacySummary(settings: LocalProfileSettings, user: AuthUser, text: SourceTextFn = (source) => source) {
  if (user.isPublic === false || settings.whoCanViewMe === 'private') return text('较私密')
  if (!settings.searchable) return text('不可搜索')
  return text('常规')
}

function calculateAge(birthDate?: string | null) {
  if (isPrivateBirthDate(birthDate)) return null
  const match = String(birthDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const today = new Date()
  let age = today.getFullYear() - Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (today.getMonth() < month || (today.getMonth() === month && today.getDate() < day)) age -= 1
  return age >= 0 && age <= 120 ? age : null
}

function dateFromBirthValue(value?: string | null) {
  if (isPrivateBirthDate(value)) return new Date(2000, 0, 1)
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return new Date(2000, 0, 1)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function formatBirthDateDisplay(value?: string | null) {
  if (isPrivateBirthDate(value)) return ''
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

function isPrivateBirthDate(value?: string | null) {
  return String(value ?? '').trim() === PRIVATE_BIRTH_DATE
}

function formatBirthDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1 },
    content: { paddingBottom: 120 },
    loading: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
    hero: { height: 292, backgroundColor: t.elevated, overflow: 'hidden' },
    coverImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,20,32,0.28)' },
    mediaSavingPill: { position: 'absolute', right: 16, top: 58, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.82)' },
    profileHead: { position: 'absolute', left: 18, right: 18, bottom: 22, flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.86)',
      backgroundColor: 'rgba(14,116,144,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },
    avatarSavingMask: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,20,32,0.28)' },
    identity: { flex: 1, paddingBottom: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    name: { flexShrink: 1, color: '#fff', fontSize: 24, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
    heroBadge: { width: 42, height: 42 },
    meta: { color: 'rgba(255,255,255,0.84)', fontSize: 13, marginTop: 5, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 5 },
    factRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    gender: { fontSize: 24, fontWeight: '900', lineHeight: 28, textShadowColor: 'rgba(0,0,0,0.28)', textShadowRadius: 4 },
    fact: { color: '#fff', fontSize: 13, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.28)', textShadowRadius: 4 },
    body: { paddingHorizontal: 16, paddingTop: 16 },
    bio: { color: t.text, fontSize: 14, lineHeight: 21, marginBottom: 14 },
    statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
    statItem: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4 },
    statDivider: { width: 0.5, height: 30, backgroundColor: t.border },
    statValue: { color: t.text, fontSize: 16, fontWeight: '800', maxWidth: '100%' },
    statLabel: { color: t.textDim, fontSize: 11, marginTop: 4 },
    infoPanel: { backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, borderRadius: 14, overflow: 'hidden' },
    infoRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: t.border },
    infoLabel: { width: 84, color: t.textDim, fontSize: 13 },
    infoValue: { flex: 1, color: t.text, fontSize: 14, fontWeight: '600', textAlign: 'right' },
    infoValueAccent: { color: t.accent, fontWeight: '800' },
    menuValueWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 },
    chevron: { color: t.textDim, fontSize: 24, fontWeight: '600', lineHeight: 26 },
    logoutButton: { marginTop: 14, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 0.5, borderColor: 'rgba(248,113,113,0.28)' },
    logoutText: { color: t.danger, fontSize: 14, fontWeight: '700' },
    versionText: { color: t.textDim, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 12 },
    badgeModalLayer: { flex: 1, justifyContent: 'flex-end' },
    badgeBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7, 20, 32, 0.38)' },
    badgeSheet: {
      maxHeight: '86%',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: t.surface,
      borderWidth: 0.5,
      borderColor: t.border,
    },
    settingsScreen: { flex: 1, backgroundColor: '#f2f2f7' },
    settingsNav: {
      height: 104,
      paddingTop: 58,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(60,60,67,0.22)',
      backgroundColor: 'rgba(248,248,248,0.94)',
    },
    settingsNavButton: { minWidth: 58, height: 40, justifyContent: 'center' },
    settingsNavButtonText: { color: '#007aff', fontSize: 17, fontWeight: '600' },
    settingsNavButtonDisabled: { opacity: 0.45 },
    settingsNavTitle: { color: '#111', fontSize: 17, fontWeight: '700' },
    cropSheet: {},
    sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: t.borderStrong, marginBottom: 12 },
    badgeSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 14 },
    badgeSheetTitle: { color: t.text, fontSize: 22, fontWeight: '900' },
    badgeSheetSubtitle: { color: t.textDim, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 260 },
    sheetClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt },
    sheetCloseText: { color: t.text, fontSize: 22, fontWeight: '800', lineHeight: 24 },
    badgeList: { paddingBottom: 14 },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badgeOption: {
      width: '31.8%',
      minHeight: 134,
      paddingHorizontal: 6,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: t.surfaceAlt,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    badgeOptionActive: { borderColor: t.accent, backgroundColor: 'rgba(0,119,182,0.08)' },
    badgeOptionImage: { width: 58, height: 58, marginBottom: 7 },
    badgeOptionTitle: { color: t.text, fontSize: 12, lineHeight: 15, fontWeight: '900', maxWidth: '100%', minHeight: 30, textAlign: 'center' },
    badgeState: { marginTop: 8, minWidth: 52, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,48,71,0.08)' },
    badgeStateActive: { backgroundColor: t.accent },
    badgeStateText: { color: t.textDim, fontSize: 11, fontWeight: '800' },
    badgeStateTextActive: { color: '#fff' },
    clearBadgeButton: { marginTop: 12, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,48,71,0.06)', borderWidth: 0.5, borderColor: t.border },
    clearBadgeText: { color: t.text, fontSize: 13, fontWeight: '800' },
    badgeError: { color: t.danger, fontSize: 12, fontWeight: '700', marginTop: 10 },
    badgeLoading: { color: t.textDim, fontSize: 12, fontWeight: '700', marginBottom: 10 },
    settingsContent: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 48, gap: 26 },
    settingsGroup: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#fff',
      borderWidth: 0.5,
      borderColor: 'rgba(60,60,67,0.12)',
    },
    fieldWrap: {
      minHeight: 48,
      paddingLeft: 16,
      paddingRight: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(60,60,67,0.18)',
      backgroundColor: '#fff',
      gap: 14,
    },
    fieldLabel: { width: 102, color: '#111', fontSize: 16, fontWeight: '400' },
    input: { flex: 1, minHeight: 48, color: '#111', paddingHorizontal: 0, paddingVertical: 10, fontSize: 16, fontWeight: '400', textAlign: 'right' },
    inputMultiline: { minHeight: 104, paddingTop: 13, textAlign: 'left', textAlignVertical: 'top' },
    dateValue: { flex: 1, color: '#111', fontSize: 16, fontWeight: '400', textAlign: 'right' },
    datePlaceholder: { color: 'rgba(60,60,67,0.46)' },
    settingsChevron: { color: 'rgba(60,60,67,0.32)', fontSize: 26, fontWeight: '300', lineHeight: 28 },
    segmentRow: { flex: 1, minHeight: 32, flexDirection: 'row', padding: 2, borderRadius: 8, backgroundColor: 'rgba(118,118,128,0.16)' },
    segmentButton: { flex: 1, minHeight: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    segmentButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    segmentText: { color: '#3c3c43', fontSize: 13, fontWeight: '600' },
    segmentTextActive: { color: '#111' },
    toggleRow: {
      minHeight: 50,
      paddingLeft: 16,
      paddingRight: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(60,60,67,0.18)',
      backgroundColor: '#fff',
    },
    toggleRowDisabled: { opacity: 0.55 },
    toggleLabel: { flex: 1, color: '#111', fontSize: 16, fontWeight: '400' },
    infoNote: { marginTop: -18, paddingHorizontal: 16, color: 'rgba(60,60,67,0.72)', fontSize: 13, lineHeight: 18, fontWeight: '400' },
    datePickerLayer: { flex: 1, justifyContent: 'flex-end' },
    datePickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
    datePickerSheet: {
      paddingBottom: 26,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#f2f2f7',
    },
    datePickerToolbar: {
      height: 50,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(60,60,67,0.22)',
      backgroundColor: 'rgba(248,248,248,0.94)',
    },
    datePickerToolbarButton: { minWidth: 56, height: 44, justifyContent: 'center' },
    datePickerTitle: { color: '#111', fontSize: 16, fontWeight: '700' },
    datePickerClearText: { color: '#ff3b30', fontSize: 16, fontWeight: '500' },
    datePickerDoneText: { color: '#007aff', fontSize: 16, fontWeight: '700', textAlign: 'right' },
    datePicker: { alignSelf: 'stretch', height: 216 },
    languagePickerSheet: {
      maxHeight: '74%',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#f2f2f7',
    },
    languageOptionList: { paddingBottom: 22 },
    languageOption: {
      minHeight: 58,
      paddingLeft: 18,
      paddingRight: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(60,60,67,0.18)',
      backgroundColor: '#fff',
    },
    languageOptionTextWrap: { flex: 1, minWidth: 0, paddingVertical: 9 },
    languageOptionLabel: { color: '#111', fontSize: 16, fontWeight: '500' },
    languageOptionDetail: { color: 'rgba(60,60,67,0.58)', fontSize: 12, fontWeight: '500', marginTop: 3 },
    languageOptionCheck: { width: 24, color: 'transparent', fontSize: 20, fontWeight: '800', textAlign: 'right' },
    languageOptionCheckActive: { color: '#007aff' },
    photoPickerScreen: { flex: 1, backgroundColor: '#000' },
    photoPickerHeader: { height: 96, paddingTop: 46, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.16)' },
    photoPickerHeaderButton: { width: 72, height: 38, justifyContent: 'center' },
    photoPickerHeaderText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    photoPickerTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
    photoPickerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    photoPermissionEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
    photoPermissionTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
    photoPermissionText: { color: 'rgba(255,255,255,0.68)', fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center', marginBottom: 22 },
    photoPermissionButton: { minWidth: 132, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    photoPermissionButtonText: { color: '#061826', fontSize: 15, fontWeight: '900' },
    photoGrid: { padding: 2, paddingBottom: 32 },
    photoTile: { width: '33.3333%', aspectRatio: 1, padding: 2 },
    photoTileImage: { width: '100%', height: '100%', backgroundColor: '#111' },
    photoEmptyText: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 120 },
    photoMoreTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b3b3b' },
    photoMorePlus: { color: 'rgba(255,255,255,0.7)', fontSize: 44, lineHeight: 48, fontWeight: '300', marginBottom: 4 },
    photoMoreTileText: { color: 'rgba(255,255,255,0.58)', fontSize: 18, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
    cropFullscreen: { flex: 1, backgroundColor: '#000' },
    cropTopBar: { height: 96, paddingTop: 46, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cropTopButton: { minWidth: 62, height: 38, alignItems: 'center', justifyContent: 'center' },
    cropTopButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    cropTopTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
    cropFullscreenStage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 72 },
    cropFrame: { backgroundColor: '#070707', overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.95)' },
    cropFrameAvatar: { borderRadius: 999 },
    cropFrameCover: { borderRadius: 0 },
    cropImage: { position: 'absolute' },
    cropHint: { color: 'rgba(255,255,255,0.66)', fontSize: 13, fontWeight: '700', marginTop: 20 },
    saveButton: { height: 46, borderRadius: 12, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    saveButtonDisabled: { opacity: 0.55 },
    saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
    guestCard: {
      marginHorizontal: 16,
      marginTop: 86,
      padding: 20,
      borderRadius: 20,
      backgroundColor: t.surface,
      borderWidth: 0.5,
      borderColor: t.border,
    },
    guestAvatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: t.elevated, borderWidth: 0.5, borderColor: t.border, marginBottom: 16 },
    guestAvatarText: { color: t.textDim, fontSize: 32, fontWeight: '800' },
    guestTitle: { color: t.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
    guestSubtitle: { color: t.textDim, fontSize: 14, lineHeight: 21, marginBottom: 18 },
    loginButton: { alignSelf: 'flex-start', borderRadius: 12, backgroundColor: t.accent, paddingHorizontal: 20, paddingVertical: 11 },
    loginButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  })
}
