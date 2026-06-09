import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { listVoyages } from '../voyage/api'
import { colors } from '../../theme/tokens'
import { confirmPoi, createDiscoveryPoint, createPoi, listDiscoveryPoints, listPois, unlockDiscovery, type DiscoveryPointRecord, type PoiRecord } from './api'

export function MapScreen() {
  const [pois, setPois] = useState<PoiRecord[]>([])
  const [points, setPoints] = useState<DiscoveryPointRecord[]>([])
  const [voyageId, setVoyageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstPoint = points[0]
  const firstPoi = pois[0]
  const canUnlock = useMemo(() => !!firstPoint && !!voyageId, [firstPoint, voyageId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [poiList, pointList, voyages] = await Promise.all([listPois(), listDiscoveryPoints(), listVoyages()])
      setPois(poiList)
      setPoints(pointList)
      setVoyageId(voyages.find((item) => item.status === 'active' || item.status === 'completed')?.id ?? null)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load map')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(kind: 'poi' | 'confirm' | 'point' | 'unlock') {
    setBusy(true)
    setError(null)
    try {
      if (kind === 'poi') await createPoi()
      if (kind === 'confirm' && firstPoi) await confirmPoi(firstPoi.id)
      if (kind === 'point') await createDiscoveryPoint(firstPoi?.id)
      if (kind === 'unlock' && firstPoint && voyageId) await unlockDiscovery(firstPoint.id, voyageId)
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <LinearGradient colors={[colors.skyBottom, '#ffffff']} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View><Text style={styles.kicker}>MAP</Text><Text style={styles.title}>Landmarks & Discovery</Text></View>
        </View>
        {loading ? <ActivityIndicator color={colors.accent} /> : (
          <ScrollView contentContainerStyle={styles.content}>
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.actions}>
              <Pressable disabled={busy} style={styles.primary} onPress={() => act('poi')}><Text style={styles.primaryText}>Add POI</Text></Pressable>
              <Pressable disabled={busy || !firstPoi} style={[styles.secondary, !firstPoi && styles.disabled]} onPress={() => act('confirm')}><Text style={styles.secondaryText}>Confirm POI</Text></Pressable>
            </View>
            <View style={styles.actions}>
              <Pressable disabled={busy} style={styles.primary} onPress={() => act('point')}><Text style={styles.primaryText}>Add Discovery</Text></Pressable>
              <Pressable disabled={busy || !canUnlock} style={[styles.secondary, !canUnlock && styles.disabled]} onPress={() => act('unlock')}><Text style={styles.secondaryText}>{voyageId ? 'Unlock' : 'Need Voyage'}</Text></Pressable>
            </View>
            <Text style={styles.sectionTitle}>POI</Text>
            {pois.slice(0, 6).map((poi) => <Card key={poi.id} title={poi.name} meta={`${poi.type} · ${poi.confirmCount} confirmations`} />)}
            <Text style={styles.sectionTitle}>Discovery</Text>
            {points.slice(0, 6).map((point) => <Card key={point.id} title={point.name} meta={`${point.type} · radius ${point.radiusM}m`} />)}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  )
}

function Card({ title, meta }: { title: string; meta: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardMeta}>{meta}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panelStrong, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  backText: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '700' },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  content: { gap: 12, paddingBottom: 40 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondary: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  secondaryText: { color: colors.accent, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { color: '#b91c1c', fontWeight: '800' },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 10 },
  card: { padding: 14, borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  cardMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
})
