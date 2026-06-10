import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getCaptainHud } from '../home/api'
import { listVoyages } from '../voyage/api'
import { colors } from '../../theme/tokens'
import { cacheLogs, createLog, createLogOffline, listCachedLogs, listLogs, type LogEntry } from './api'

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
      await cacheLogs(nextLogs)
    } catch (err: any) {
      const cached = await listCachedLogs(vesselId)
      setLogs(cached)
      setError(cached.length ? 'Using local cache' : err?.message ?? 'Failed to load logs')
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
      try {
        const local = await createLogOffline(vesselId, voyageId)
        setLogs((current) => [local, ...current])
        setError('Saved locally. Sync will retry when online.')
      } catch (offlineErr: any) {
        setError(offlineErr?.message ?? err?.message ?? 'Failed to create log')
      }
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
      <View><Text style={styles.kicker}>{kicker}</Text><Text style={styles.title}>{title}</Text></View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 18, paddingTop: 18 },
  header: { marginBottom: 20 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  content: { gap: 12, paddingBottom: 120 },
  primary: { paddingVertical: 13, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { color: '#b91c1c', fontWeight: '800' },
  card: { padding: 14, borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  cardKicker: { color: colors.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 4 },
  cardBody: { color: colors.muted, fontWeight: '700', marginTop: 4 },
})
