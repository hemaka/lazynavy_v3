import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme/tokens'

export function ModuleScreen({ title, kicker, body }: { title: string; kicker: string; body: string }) {
  return (
    <LinearGradient colors={[colors.skyBottom, '#ffffff']} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.panel}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panelStrong, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  backText: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '700' },
  panel: { marginTop: 22, paddingVertical: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 12, fontWeight: '600' },
})
