import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getCaptainHud } from '../home/api'
import { listVoyages } from '../voyage/api'
import { colors } from '../../theme/tokens'
import { createLog, listLogs, type LogEntry } from './api'

export function LogScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [vesselId, setVesselId] = useState<string | null>(null)
  const [voyageId, setVoyageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [hud, voyages, nextLogs] = await Promise.all([getCaptainHud(), listVoyages(), listLogs()])
      setVesselId(hud.currentVessel?.id ?? null)
      setVoyageId(voyages.find((item) => item.status === 'active' || item.status === 'completed')?.id ?? null)
      setLogs(nextLogs)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function addLog() {
    if (!vesselId) return
    setBusy(true)
    try {
      await createLog(vesselId, voyageId)
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create log')
    } finally {
      setBusy(false)
    }
  }

  return (
    <LinearGradient colors={[colors.skyBottom, '#ffffff']} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <Header title="Boat Life Log" kicker="LOG" />
        {loading ? <ActivityIndicator color={colors.accent} /> : (
          <ScrollView contentContainerStyle={styles.content}>
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable disabled={!vesselId || busy} style={[styles.primary, (!vesselId || busy) && styles.disabled]} onPress={addLog}>
              <Text style={styles.primaryText}>{vesselId ? 'Add Log' : 'Create Boat First'}</Text>
            </Pressable>
            {logs.map((log) => (
              <View key={log.id} style={styles.card}>
                <Text style={styles.cardKicker}>{log.type}</Text>
                <Text style={styles.cardTitle}>{log.title}</Text>
                {!!log.body && <Text style={styles.cardBody}>{log.body}</Text>}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  )
}

function Header({ title, kicker }: { title: string; kicker: string }) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
      <View><Text style={styles.kicker}>{kicker}</Text><Text style={styles.title}>{title}</Text></View>
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
  title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  content: { gap: 12, paddingBottom: 40 },
  primary: { paddingVertical: 13, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { color: '#b91c1c', fontWeight: '800' },
  card: { padding: 14, borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  cardKicker: { color: colors.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 4 },
  cardBody: { color: colors.muted, fontWeight: '700', marginTop: 4 },
})
