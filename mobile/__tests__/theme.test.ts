import { colors } from '../theme/colors';

// Locks the mobile palette to the web app's dark theme (the dark block in
// src/index.css plus the manifest theme_color) — the visual parallel of the
// storage-key parity test. Whole-object equality also guards against stray or
// missing tokens.
describe('theme colors', () => {
  it('matches the web app dark palette', () => {
    expect(colors).toEqual({
      brand: '#1a1626',
      background: '#16171d',
      surface: '#1f2028',
      border: '#2e303a',
      text: '#9ca3af',
      textStrong: '#f3f4f6',
      accent: '#c084fc',
      onAccent: '#ffffff',
    });
  });
});
