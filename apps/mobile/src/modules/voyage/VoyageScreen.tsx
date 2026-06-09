import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getCaptainHud } from '../home/api'
import { colors } from '../../theme/tokens'
import { completeVoyage, createVoyagePlan, listVoyages, startVoyage, type VoyageRecord } from './api'

export function VoyageScreen() {
  const [vesselId, setVesselId] = useState<string | null>(null)
  const [voyages, setVoyages] = useState<VoyageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active = useMemo(() => voyages.find((item) => item.status === 'active') ?? voyages.find((item) => item.status === 'planned') ?? null, [voyages])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [hud, list] = await Promise.all([getCaptainHud(), listVoyages()])
      setVesselId(hud.currentVessel?.id ?? null)
      setVoyages(list)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load voyage')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(kind: 'create' | 'start' | 'complete') {
    setBusy(true)
    setError(null)
    try {
      if (kind === 'create') {
        if (!vesselId) throw new Error('Create a boat first')
        await createVoyagePlan(vesselId)
      } else if (kind === 'start' && active) {
        await startVoyage(active.id)
      } else if (kind === 'complete' && active) {
        await completeVoyage(active.id)
      }
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
          <View>
            <Text style={styles.kicker}>VOYAGE</Text>
            <Text style={styles.title}>Current Voyage</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {error && <Text style={styles.error}>{error}</Text>}
            {active ? (
              <View style={styles.panel}>
                <Text style={styles.status}>{active.status.toUpperCase()}</Text>
                <Text style={styles.name}>{active.name}</Text>
                <Text style={styles.route}>{active.departureName ?? 'Departure'} → {active.destinationName ?? 'Destination'}</Text>
                <Text style={styles.meta}>{active.needsConfirmation ? 'Needs confirmation' : 'Ready'} · {active.participants?.length ?? 1} participant(s)</Text>
                <View style={styles.actions}>
                  {active.status === 'planned' && <Pressable disabled={busy} style={styles.primary} onPress={() => act('start')}><Text style={styles.primaryText}>Start</Text></Pressable>}
                  {active.status === 'active' && <Pressable disabled={busy} style={styles.primary} onPress={() => act('complete')}><Text style={styles.primaryText}>Complete</Text></Pressable>}
                  <Pressable disabled={busy} style={styles.secondary} onPress={load}><Text style={styles.secondaryText}>Refresh</Text></Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.panel}>
                <Text style={styles.status}>NO ACTIVE PLAN</Text>
                <Text style={styles.name}>Plan a short run</Text>
                <Text style={styles.route}>Create a voyage plan from your current boat.</Text>
                <Pressable disabled={busy || !vesselId} style={[styles.primary, !vesselId && styles.disabled]} onPress={() => act('create')}>
                  <Text style={styles.primaryText}>{vesselId ? 'Create Plan' : 'Create Boat First'}</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.list}>
              <Text style={styles.sectionTitle}>Recent</Text>
              {voyages.slice(0, 8).map((voyage) => (
                <View key={voyage.id} style={styles.row}>
                  <Text style={styles.rowTitle}>{voyage.name}</Text>
                  <Text style={styles.rowStatus}>{voyage.status}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panelStrong, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  backText: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '700' },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 22, paddingBottom: 40, gap: 16 },
  panel: { padding: 18, borderRadius: 18, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  status: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  name: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 6 },
  route: { color: colors.muted, fontSize: 14, fontWeight: '700', marginTop: 6 },
  meta: { color: colors.orange, fontSize: 12, fontWeight: '800', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primary: { minWidth: 120, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondary: { minWidth: 120, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  secondaryText: { color: colors.accent, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { color: '#b91c1c', fontWeight: '800' },
  list: { gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  row: { padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-between' },
  rowTitle: { color: colors.ink, fontWeight: '800' },
  rowStatus: { color: colors.muted, fontWeight: '800', textTransform: 'capitalize' },
})
