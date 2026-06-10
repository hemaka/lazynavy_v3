import { colors } from './tokens'

export function useTheme() {
  return {
    bg: colors.skyBottom,
    surface: '#ffffff',
    surfaceAlt: 'rgba(241,245,249,0.96)',
    elevated: 'rgba(255,255,255,0.94)',
    border: colors.line,
    borderStrong: 'rgba(18,48,71,0.24)',
    text: colors.ink,
    textDim: colors.muted,
    textSoft: 'rgba(95,125,144,0.36)',
    accent: colors.accent,
    accentSoft: 'rgba(0,119,182,0.12)',
    accentBright: '#38bdf8',
    danger: '#dc2626',
    success: colors.green,
    oceanDeep: colors.seaDeep,
    statusDark: false,
    photoOverlay: 'rgba(7,29,54,0.42)',
  }
}
