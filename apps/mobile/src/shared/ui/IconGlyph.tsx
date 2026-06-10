import { Text, type TextStyle } from 'react-native'

const glyphs: Record<string, string> = {
  home: '⌂',
  route: '◢',
  map: '⌖',
  book: '▤',
  wrench: '☼',
  box: '$',
  gear: '≡',
  crew: '♙',
  file: '☑',
  layout: '□',
  camera: '◉',
  user: '◎',
  message: '✉',
}

export function IconGlyph({ name, color = '#123047', size = 18, style }: { name: string; color?: string; size?: number; style?: TextStyle }) {
  return (
    <Text style={[{ color, fontSize: size, fontWeight: '900' }, style]}>
      {glyphs[name] ?? name.slice(0, 1).toUpperCase()}
    </Text>
  )
}
