import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme/tokens'
import { convertCurrency, convertUnit, getRegionInfo } from './api'

export function ToolboxScreen() {
  const [unit, setUnit] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [region, setRegion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [unitResult, currencyResult, regionResult] = await Promise.all([
        convertUnit(12, 'nm', 'km'),
        convertCurrency(100, 'USD', 'EUR'),
        getRegionInfo('US'),
      ])
      setUnit(`12 nm = ${unitResult.result.toFixed(1)} km`)
      setCurrency(`100 USD = ${currencyResult.result.toFixed(2)} EUR`)
      setRegion(`${regionResult.name} · ${regionResult.vhfEmergency}`)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load toolbox')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <LinearGradient colors={[colors.skyBottom, '#ffffff']} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View>
            <Text style={styles.kicker}>TOOLBOX</Text>
            <Text style={styles.title}>Shortcut Tools</Text>
          </View>
        </View>
        {loading ? <ActivityIndicator color={colors.accent} /> : (
          <ScrollView contentContainerStyle={styles.content}>
            {error && <Text style={styles.error}>{error}</Text>}
            {[unit, currency, region].filter(Boolean).map((item) => (
              <View key={item} style={styles.card}>
                <Text style={styles.cardTitle}>{item}</Text>
              </View>
            ))}
            <Pressable style={styles.primary} onPress={load}><Text style={styles.primaryText}>Refresh</Text></Pressable>
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
  card: { padding: 16, borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  primary: { paddingVertical: 13, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '900' },
  error: { color: '#b91c1c', fontWeight: '800' },
})
