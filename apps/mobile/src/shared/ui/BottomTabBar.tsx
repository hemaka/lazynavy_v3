import { usePathname } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { bottomNav, isBottomNavActive } from '../../navigation/navConfig'
import { useBottomNavTransition } from '../../navigation/bottomNavTransition'
import { useI18n } from '../../i18n'
import { colors } from '../../theme/tokens'
import { IconGlyph } from './IconGlyph'

export function BottomTabBar() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const { bottomNavHidden, navigateBottomNav } = useBottomNavTransition()
  const { text } = useI18n()
  const bottom = Math.max(insets.bottom, 8)
  const navTranslateY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(navTranslateY, {
      toValue: bottomNavHidden ? bottom + 86 : 0,
      duration: bottomNavHidden ? 220 : 260,
      useNativeDriver: true,
    }).start()
  }, [bottom, bottomNavHidden, navTranslateY])

  return (
    <Animated.View
      pointerEvents={bottomNavHidden ? 'none' : 'auto'}
      style={[styles.bottomNav, { bottom, transform: [{ translateY: navTranslateY }] }]}
    >
      {bottomNav.map((item, index) => {
        const active = isBottomNavActive(pathname, item.href)
        return (
          <Pressable
            key={item.key}
            accessibilityState={{ selected: active, disabled: active }}
            disabled={active}
            style={[styles.navItem, active && styles.navItemActive, index === bottomNav.length - 1 && styles.navItemLast]}
            onPress={() => navigateBottomNav(item.href, pathname)}
          >
            <IconGlyph name={item.icon} color={active ? colors.ink : colors.accent} size={24} />
            <Text style={[styles.navText, active && styles.navTextActive]}>{text(item.label)}</Text>
          </Pressable>
        )
      })}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(244,252,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.76)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#075985',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    paddingHorizontal: 6,
    zIndex: 100,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navItemActive: {
    backgroundColor: 'rgba(14,116,144,0.1)',
  },
  navItemLast: {},
  navText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  navTextActive: { fontWeight: '900' },
})
