// Shared dark-theme color tokens for the iOS app — the React Native parallel to
// the web app's CSS custom properties (the dark block in src/index.css) and the
// PWA `theme_color`. Single source of truth for screen/component styling. This is
// UI only: the reused @core has no styling, so theme tokens live here in mobile/.
export const colors = {
  /** App brand / nav header background (web `theme_color`). */
  brand: '#1a1626',
  /** Screen background. */
  background: '#16171d',
  /** Raised surfaces: cards, grid cells, inputs. */
  surface: '#1f2028',
  /** Hairline borders / dividers. */
  border: '#2e303a',
  /** Secondary / body text. */
  text: '#9ca3af',
  /** Strong / heading text. */
  textStrong: '#f3f4f6',
  /** Interactive accent: selected hands, links, header tint. */
  accent: '#c084fc',
  /** Text / icons on an accent-filled surface. */
  onAccent: '#ffffff',
} as const;

export type Colors = typeof colors;
