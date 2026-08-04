// Coach typography — semantic font-family names for the mobile app, mirroring the
// web pairing: Bricolage Grotesque for display (headings, hero numbers) and
// Instrument Sans for UI/body. The actual font files are loaded once with `useFonts`
// in app/_layout.tsx; these are the family-name strings referenced in `fontFamily`
// styles. (Kept free of asset `require`s so screens can import it under Jest.)
export const fonts = {
  /** Display / hero numbers — heaviest Bricolage weight. */
  display: 'BricolageGrotesque_700Bold',
  /** Section + card headings. */
  displaySemibold: 'BricolageGrotesque_600SemiBold',
  /** Lighter display accents. */
  displayMedium: 'BricolageGrotesque_500Medium',
  /** Default body / UI text. */
  body: 'InstrumentSans_400Regular',
  /** Emphasized body / labels. */
  bodyMedium: 'InstrumentSans_500Medium',
  /** Buttons, chips, strong labels. */
  bodySemibold: 'InstrumentSans_600SemiBold',
  /** Heaviest UI weight. */
  bodyBold: 'InstrumentSans_700Bold',
} as const;
