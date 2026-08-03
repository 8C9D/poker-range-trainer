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
  ink2: '#555758',
  ink3: '#696a66',
  accent: '#a97e14',
  // Dark enough to stay readable on accentSoft, not just on a plain surface.
  accentStrong: '#785907',
  accentSoft: '#a97e1420',
  onAccent: '#241c05',
  // Ink for text sitting on an action fill. It inverts between the themes
  // because the fills do: dark mid-tones in light mode, light ones in dark.
  onAction: '#fffef9',
  goldFill: '#d9ab33', // selected cells, primary buttons, bars
  raise: '#c2502f',
  call: '#2e8a5c',
  bet3: '#7261c9', // action colors, CVD-validated
  good: '#287750',
  bad: '#b1492b',
  heart: '#b1492b',
  diamond: '#3469b4',
  club: '#2e8a5c',
  spade: '#22252a', // 4-color deck
  h1c: '#ecdfb6',
  h2c: '#d3ab4d',
  h3c: '#8a6608', // accuracy heat: low / mid / high
  h2cInk: '#241c05',
  h3cInk: '#fffef9',
  pairbg: '#efede4',
  cellbg: '#f1efe8',
  cardface: '#fffef9',
  // Playing-card ink: identical in both palettes, because the card face stays
  // paper in dark mode and its suits must not lighten for a dark background.
  cardHeart: '#b84c2d',
  cardDiamond: '#366ebc',
  cardClub: '#297c53',
  cardSpade: '#22252a',
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
  ink3: '#858e96',
  accent: '#e2b64d',
  accentStrong: '#efc75f',
  accentSoft: '#e2b64d1f',
  onAccent: '#241c05',
  onAction: '#241c05',
  goldFill: '#d9ab33',
  raise: '#e0603c',
  call: '#35a068',
  bet3: '#8f7ae0',
  good: '#35a068',
  bad: '#e8643e',
  heart: '#e8643e',
  diamond: '#6d9fe8',
  club: '#35a068',
  spade: '#22252a',
  h1c: '#4a3c1c',
  h2c: '#8a6a24',
  h3c: '#d9b04a',
  h2cInk: '#fffef9',
  h3cInk: '#241c05',
  pairbg: '#23272d',
  cellbg: '#1b1f24',
  cardface: '#f4f1e8',
  // Playing-card ink: identical in both palettes, because the card face stays
  // paper in dark mode and its suits must not lighten for a dark background.
  cardHeart: '#b84c2d',
  cardDiamond: '#366ebc',
  cardClub: '#297c53',
  cardSpade: '#22252a',
};

/**
 * Resolve the active Coach palette from the device color scheme. `userInterfaceStyle`
 * is `automatic` (app.json), so `useColorScheme()` follows the OS light/dark setting;
 * a null scheme (unknown) falls back to light, matching the web default.
 */
export function useTheme(): ThemeColors {
  return useColorScheme() === 'dark' ? dark : light;
}
