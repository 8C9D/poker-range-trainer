// Coach design-system color tokens for the mobile app — the React Native parallel
// to the web app's CSS custom properties (`src/theme.css`, light default + dark via
// `prefers-color-scheme`). This is UI only: the reused @core has no styling, so the
// theme tokens live here in mobile/. Light + dark palettes are selected at runtime
// by `useTheme()` (driven by the device color scheme).
import { useColorScheme } from 'react-native';

// Light palette — identical values to the web `:root` block in src/theme.css.
// (No `as const`: the tokens are plain strings so light and dark share one shape.)
export const light = {
  bg: '#efede6',
  surface: '#f7f6f1',
  card: '#ffffff',
  well: '#eceade',
  line: '#dfdcd0',
  line2: '#cfccbe',
  ink: '#22252a',
  ink2: '#66696a',
  ink3: '#94958f',
  accent: '#a97e14',
  accentStrong: '#8a6608',
  accentSoft: '#a97e1420',
  onAccent: '#241c05',
  goldFill: '#d9ab33', // selected cells, primary buttons, bars
  raise: '#c2502f',
  call: '#2e8a5c',
  bet3: '#7261c9', // action colors, CVD-validated
  good: '#2e8a5c',
  bad: '#c2502f',
  heart: '#c2502f',
  diamond: '#3a76c9',
  club: '#2e8a5c',
  spade: '#22252a', // 4-color deck
  h1c: '#ecdfb6',
  h2c: '#d3ab4d',
  h3c: '#8a6608', // accuracy heat: low / mid / high
  pairbg: '#efede4',
  cellbg: '#f1efe8',
  cardface: '#fffef9',
};

export type ThemeColors = typeof light;

// Dark palette — identical values to the web `@media (prefers-color-scheme: dark)` block.
// Typed against ThemeColors so a missing/renamed token fails the build.
export const dark: ThemeColors = {
  bg: '#101316',
  surface: '#16191c',
  card: '#1e2227',
  well: '#121518',
  line: '#2a2f35',
  line2: '#3a4048',
  ink: '#e9eaec',
  ink2: '#9aa1a8',
  ink3: '#6d747b',
  accent: '#e2b64d',
  accentStrong: '#efc75f',
  accentSoft: '#e2b64d1f',
  onAccent: '#241c05',
  goldFill: '#d9ab33',
  raise: '#e0603c',
  call: '#35a068',
  bet3: '#8f7ae0',
  good: '#35a068',
  bad: '#e0603c',
  heart: '#e0603c',
  diamond: '#6d9fe8',
  club: '#35a068',
  spade: '#22252a',
  h1c: '#4a3c1c',
  h2c: '#8a6a24',
  h3c: '#d9b04a',
  pairbg: '#23272d',
  cellbg: '#1b1f24',
  cardface: '#f4f1e8',
};

/**
 * Resolve the active Coach palette from the device color scheme. `userInterfaceStyle`
 * is `automatic` (app.json), so `useColorScheme()` follows the OS light/dark setting;
 * a null scheme (unknown) falls back to light, matching the web default.
 */
export function useTheme(): ThemeColors {
  return useColorScheme() === 'dark' ? dark : light;
}

// --- Legacy dark palette (pre-Coach) --------------------------------------------
// Still consumed by the flat-route screens/components that have not yet been ported
// to the Coach IA. Removed together with those screens at the end of the port.
export const colors = {
  brand: '#1a1626',
  background: '#16171d',
  surface: '#1f2028',
  border: '#2e303a',
  text: '#9ca3af',
  textStrong: '#f3f4f6',
  accent: '#c084fc',
  onAccent: '#ffffff',
  danger: '#f87171',
} as const;

export type Colors = typeof colors;
