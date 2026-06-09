import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getCaptainHud } from '../home/api'
import { ModuleScreen } from '../../shared/ui/ModuleScreen'
import { colors } from '../../theme/tokens'
import { adjustSupply, createSupply, listSupplies, type SupplyItem } from './suppliesApi'

const labels: Record<string, string> = {
  overview: 'Boat Overview',
  supplies: 'Supplies',
  equipment: 'Equipment',
  maintenance: 'Maintenance',
  crew: 'Crew',
  documents: 'Documents',
  manuals: 'Manuals',
  layout: 'Layout',
  photos: 'Photos',
  join: 'Join Boat',
}

export function BoatSectionScreen() {
  const params = useLocalSearchParams<{ section?: string }>()
  const section = typeof params.section === 'string' ? params.section : 'overview'
  if (section === 'supplies') return <SuppliesScreen />
  const title = labels[section] ?? 'Boat Module'
  return (
    <ModuleScreen
      kicker="BOAT"
      title={title}
      body="Boat-related modules open as full-screen secondary screens. The home boat/radial menu controls entry and pinned shortcuts decide what appears on the HUD."
    />
  )
}

function SuppliesScreen() {
  const [vesselId, setVesselId] = useState<string | null>(null)
  const [items, setItems] = useState<SupplyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const hud = await getCaptainHud()
      const id = hud.currentVessel?.id ?? null
      setVesselId(id)
      setItems(id ? await listSupplies(id) : [])
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load supplies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function add() {
    if (!vesselId) return
    setBusy(true)
    try {
      await createSupply(vesselId)
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add supply')
    } finally {
      setBusy(false)
    }
  }

  async function adjust(item: SupplyItem, delta: number) {
    if (!vesselId) return
    setBusy(true)
    try {
      await adjustSupply(vesselId, item.id, delta)
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to adjust supply')
    } finally {
      setBusy(false)
    }
  }

  return (
    <LinearGradient colors={[colors.skyBottom, '#ffffff']} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View><Text style={styles.kicker}>BOAT</Text><Text style={styles.title}>Supplies</Text></View>
        </View>
        {loading ? <ActivityIndicator color={colors.accent} /> : (
          <ScrollView contentContainerStyle={styles.content}>
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable disabled={!vesselId || busy} style={[styles.primary, (!vesselId || busy) && styles.disabled]} onPress={add}>
              <Text style={styles.primaryText}>{vesselId ? 'Add Water' : 'Create Boat First'}</Text>
            </Pressable>
            {items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardMeta}>{item.category} · warn below {item.warnBelow ?? '-'} {item.unit}</Text>
                  </View>
                  <Text style={[styles.qty, item.warnBelow !== null && item.warnBelow !== undefined && item.quantity <= item.warnBelow && styles.lowQty]}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable disabled={busy} style={styles.secondary} onPress={() => adjust(item, -10)}><Text style={styles.secondaryText}>-10</Text></Pressable>
                  <Pressable disabled={busy} style={styles.secondary} onPress={() => adjust(item, 10)}><Text style={styles.secondaryText}>+10</Text></Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panelStrong, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  backText: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '700' },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  content: { gap: 12, paddingBottom: 40 },
  primary: { paddingVertical: 13, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { color: '#b91c1c', fontWeight: '800' },
  card: { padding: 14, borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line, gap: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  cardMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  qty: { color: colors.green, fontSize: 16, fontWeight: '900' },
  lowQty: { color: colors.orange },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  secondaryText: { color: colors.accent, fontWeight: '900' },
})
