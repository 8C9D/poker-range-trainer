import { actionColors } from '../theme/actionColors';
import { dark, light } from '../theme/colors';

// Locks the mobile Coach palette to the web app's tokens (`src/theme.css`) — the
// visual parallel of the storage-key parity test. Whole-object equality also guards
// against stray or missing tokens. Both light and dark are pinned so the two themes
// stay in lockstep with the web design system.
describe('theme colors', () => {
  it('matches the web app light palette (src/theme.css :root)', () => {
    expect(light).toEqual({
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
      accentStrong: '#876408',
      accentSoft: '#a97e1420',
      onAccent: '#241c05',
      goldFill: '#d9ab33',
      raise: '#c2502f',
      call: '#2e8a5c',
      bet3: '#7261c9',
      good: '#287750',
      bad: '#b1492b',
      heart: '#c2502f',
      diamond: '#3a76c9',
      club: '#2e8a5c',
      spade: '#22252a',
      h1c: '#ecdfb6',
      h2c: '#d3ab4d',
      h3c: '#8a6608',
      pairbg: '#efede4',
      cellbg: '#f1efe8',
      cardface: '#fffef9',
      cardHeart: '#b84c2d',
      cardDiamond: '#366ebc',
      cardClub: '#297c53',
      cardSpade: '#22252a',
    });
  });

  it('matches the web app dark palette (prefers-color-scheme: dark)', () => {
    expect(dark).toEqual({
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
      goldFill: '#d9ab33',
      raise: '#e0603c',
      call: '#35a068',
      bet3: '#8f7ae0',
      good: '#35a068',
      bad: '#e8643e',
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
      cardHeart: '#b84c2d',
      cardDiamond: '#366ebc',
      cardClub: '#297c53',
      cardSpade: '#22252a',
    });
  });

  it('shares the gold-fill token across themes (selected cells, primary buttons, bars)', () => {
    expect(light.goldFill).toBe('#d9ab33');
    expect(dark.goldFill).toBe(light.goldFill);
  });
});

// The three primary actions map straight onto the Coach action tokens; the rest are
// palette-derived. Both themes are checked so the mapping tracks light/dark.
describe('action colors', () => {
  it('maps raise/call/threeBet onto the Coach action tokens', () => {
    for (const theme of [light, dark]) {
      const map = actionColors(theme);
      expect(map.raise).toBe(theme.raise);
      expect(map.call).toBe(theme.call);
      expect(map.threeBet).toBe(theme.bet3);
    }
  });

  it('covers every RangeAction with a distinct fill', () => {
    const map = actionColors(light);
    const keys = Object.keys(map);
    expect(keys).toEqual(['fold', 'call', 'raise', 'threeBet', 'fourBet', 'jam', 'mixed']);
    expect(new Set(Object.values(map)).size).toBe(keys.length);
  });
});
