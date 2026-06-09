import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { createVessel, getCaptainHud } from '../home/api'
import { ModuleScreen } from '../../shared/ui/ModuleScreen'
import { colors } from '../../theme/tokens'
import {
  completeSetupStep,
  createInvitation,
  joinVessel,
  listInvitations,
  listSetupSteps,
  skipSetupStep,
  updateVessel,
  type VesselInvitation,
  type VesselSetupStep,
} from './api'
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
  if (section === 'overview') return <OverviewScreen />
  if (section === 'supplies') return <SuppliesScreen />
  if (section === 'join') return <JoinScreen />
  const title = labels[section] ?? 'Boat Module'
  return (
    <ModuleScreen
      kicker="BOAT"
      title={title}
      body="Boat-related modules open as full-screen secondary screens. The home boat/radial menu controls entry and pinned shortcuts decide what appears on the HUD."
    />
  )
}

function OverviewScreen() {
  const [vessel, setVessel] = useState<any | null>(null)
  const [steps, setSteps] = useState<VesselSetupStep[]>([])
  const [invites, setInvites] = useState<VesselInvitation[]>([])
  const [name, setName] = useState('')
  const [homePort, setHomePort] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const hud = await getCaptainHud()
      const current = hud.currentVessel ?? null
      setVessel(current)
      setName(current?.name ?? '')
      setHomePort(current?.homePort ?? '')
      if (current?.id) {
        const [nextSteps, nextInvites] = await Promise.all([listSetupSteps(current.id), listInvitations(current.id)])
        setSteps(nextSteps)
        setInvites(nextInvites)
      } else {
        setSteps([])
        setInvites([])
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load boat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function createDefaultBoat() {
    setBusy(true)
    try {
      await createVessel('LazyNavy Boat')
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create boat')
    } finally {
      setBusy(false)
    }
  }

  async function saveProfile() {
    if (!vessel?.id) return
    setBusy(true)
    try {
      await updateVessel(vessel.id, { name, homePort })
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save boat')
    } finally {
      setBusy(false)
    }
  }

  async function markStep(step: VesselSetupStep, action: 'complete' | 'skip') {
    if (!vessel?.id) return
    setBusy(true)
    try {
      if (action === 'complete') await completeSetupStep(vessel.id, step.key)
      else await skipSetupStep(vessel.id, step.key)
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update setup')
    } finally {
      setBusy(false)
    }
  }

  async function inviteCrew() {
    if (!vessel?.id) return
    setBusy(true)
    try {
      await createInvitation(vessel.id, 'crew')
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <LinearGradient colors={[colors.skyBottom, '#ffffff']} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <Header title="Boat Overview" />
        {loading ? <ActivityIndicator color={colors.accent} /> : (
          <ScrollView contentContainerStyle={styles.content}>
            {error && <Text style={styles.error}>{error}</Text>}
            {!vessel ? (
              <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={createDefaultBoat}>
                <Text style={styles.primaryText}>Create Boat</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Profile</Text>
                  <TextInput value={name} onChangeText={setName} placeholder="Boat name" style={styles.input} />
                  <TextInput value={homePort} onChangeText={setHomePort} placeholder="Home port" style={styles.input} />
                  <Pressable disabled={busy} style={styles.primary} onPress={saveProfile}><Text style={styles.primaryText}>Save Profile</Text></Pressable>
                </View>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <View>
                      <Text style={styles.cardTitle}>Setup Quest</Text>
                      <Text style={styles.cardMeta}>{steps.filter((step) => step.status !== 'open').length}/{steps.length} done</Text>
                    </View>
                    <Text style={styles.badge}>{vessel.setupStatus ?? 'started'}</Text>
                  </View>
                  {steps.map((step) => (
                    <View key={step.id} style={styles.stepRow}>
                      <View style={styles.stepText}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.cardMeta}>{step.status}</Text>
                      </View>
                      {step.status === 'open' && (
                        <View style={styles.stepActions}>
                          <Pressable disabled={busy} style={styles.smallButton} onPress={() => markStep(step, 'skip')}><Text style={styles.secondaryText}>Skip</Text></Pressable>
                          <Pressable disabled={busy} style={styles.smallButton} onPress={() => markStep(step, 'complete')}><Text style={styles.secondaryText}>Done</Text></Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <View>
                      <Text style={styles.cardTitle}>Crew Invites</Text>
                      <Text style={styles.cardMeta}>{invites.filter((invite) => invite.status === 'active').length} active</Text>
                    </View>
                    <Pressable disabled={busy} style={styles.smallButton} onPress={inviteCrew}><Text style={styles.secondaryText}>New</Text></Pressable>
                  </View>
                  {invites.slice(0, 4).map((invite) => (
                    <Text key={invite.id} style={styles.inviteCode}>{invite.code} · {invite.role} · {invite.status}</Text>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  )
}

function JoinScreen() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join() {
    setBusy(true)
    setError(null)
    try {
      const joined = await joinVessel(code)
      setResult(`${joined.vessel.name} · ${joined.membership.role}`)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to join boat')
    } finally {
      setBusy(false)
    }
  }

  return (
    <LinearGradient colors={[colors.skyBottom, '#ffffff']} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <Header title="Join Boat" />
        <View style={styles.content}>
          {error && <Text style={styles.error}>{error}</Text>}
          {result && <Text style={styles.success}>{result}</Text>}
          <TextInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="Invite code" autoCapitalize="characters" style={styles.input} />
          <Pressable disabled={busy || !code.trim()} style={[styles.primary, (busy || !code.trim()) && styles.disabled]} onPress={join}>
            <Text style={styles.primaryText}>Join</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
      <View><Text style={styles.kicker}>BOAT</Text><Text style={styles.title}>{title}</Text></View>
    </View>
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
        <Header title="Supplies" />
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
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', paddingHorizontal: 12, color: colors.ink, fontWeight: '800' },
  badge: { color: colors.accent, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  stepText: { flex: 1 },
  stepTitle: { color: colors.ink, fontWeight: '900' },
  stepActions: { flexDirection: 'row', gap: 8 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  inviteCode: { color: colors.ink, fontWeight: '900', paddingVertical: 4 },
  success: { color: colors.green, fontWeight: '900' },
  qty: { color: colors.green, fontSize: 16, fontWeight: '900' },
  lowQty: { color: colors.orange },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  secondaryText: { color: colors.accent, fontWeight: '900' },
})
