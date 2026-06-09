import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme/tokens'
import { SyncWorker } from './syncWorker'

export function SyncStatusBar() {
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Local cache ready')

  async function refresh() {
    try {
      setPending(await SyncWorker.pendingCount())
    } catch {
      setPending(0)
    }
  }

  async function syncNow() {
    setBusy(true)
    try {
      await SyncWorker.bootstrap()
      const remaining = await SyncWorker.pushPending()
      setPending(remaining)
      setMessage(remaining ? `${remaining} pending` : 'Synced')
    } catch {
      setMessage(pending ? `${pending} pending offline` : 'Offline cache')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <Pressable style={styles.bar} onPress={syncNow} disabled={busy}>
      <View style={[styles.dot, pending > 0 && styles.dotPending]} />
      <Text style={styles.text}>{busy ? 'Syncing' : message}{pending > 0 ? ` · ${pending}` : ''}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: { marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  dotPending: { backgroundColor: colors.orange },
  text: { color: colors.muted, fontSize: 11, fontWeight: '800' },
})
