import { Platform } from 'react-native'

export const colors = {
  ink: '#111111',
  paper: '#f3f1eb',
  soft: '#d8d6ce',
  muted: '#73736d',
  copper: '#b46d47',
  line: '#c8c6bd',
  white: '#fffef9',
}

export const typography = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
}
