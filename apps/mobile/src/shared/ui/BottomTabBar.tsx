import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { bottomNav } from '../../navigation/navConfig'
import { colors } from '../../theme/tokens'
import { IconGlyph } from './IconGlyph'

export function BottomTabBar() {
  const insets = useSafeAreaInsets()
  const bottom = Math.max(insets.bottom, 10) + 10

  return (
    <View style={[styles.bottomNav, { bottom }]}>
      {bottomNav.map((item, index) => (
        <Pressable
          key={item.key}
          style={[styles.navItem, index === bottomNav.length - 1 && styles.navItemLast]}
          onPress={() => router.push(item.href as never)}
        >
          <IconGlyph name={item.icon} color={colors.accent} size={24} />
          <Text style={styles.navText}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(244,252,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#075985',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  navItem: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRightWidth: 1,
    borderRightColor: 'rgba(14,116,144,0.12)',
  },
  navItemLast: { borderRightWidth: 0 },
  navText: { color: colors.ink, fontSize: 10, fontWeight: '600' },
})
