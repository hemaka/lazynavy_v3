import { Text, type TextStyle } from 'react-native'

const glyphs: Record<string, string> = {
  route: 'R',
  map: 'M',
  book: 'L',
  wrench: 'T',
  box: 'S',
  gear: 'E',
  crew: 'C',
  file: 'D',
  layout: 'P',
  camera: 'I',
}

export function IconGlyph({ name, color = '#123047', size = 18, style }: { name: string; color?: string; size?: number; style?: TextStyle }) {
  return (
    <Text style={[{ color, fontSize: size, fontWeight: '900', fontFamily: 'monospace' }, style]}>
      {glyphs[name] ?? name.slice(0, 1).toUpperCase()}
    </Text>
  )
}
