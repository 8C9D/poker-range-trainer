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
      accentStrong: '#785907',
      accentSoft: '#a97e1420',
      onAccent: '#241c05',
      onAction: '#fffef9',
      goldFill: '#d9ab33',
      raise: '#c2502f',
      call: '#2e8a5c',
      bet3: '#7261c9',
      good: '#287750',
      bad: '#b1492b',
      heart: '#b1492b',
      diamond: '#3469b4',
      club: '#2e8a5c',
      spade: '#22252a',
      h1c: '#ecdfb6',
      h2c: '#d3ab4d',
      h3c: '#8a6608',
      h2cInk: '#241c05',
      h3cInk: '#fffef9',
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

/** Relative luminance per WCAG 2.x. */
function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  );
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Composite an `#rrggbbaa` tint onto an opaque `#rrggbb` surface. */
function blend(tint: string, surface: string): string {
  const t = parseInt(tint.slice(1), 16);
  const s = parseInt(surface.slice(1), 16);
  const alpha = (t & 255) / 255;
  const channel = (shift: number) =>
    Math.round(alpha * ((t >>> (shift + 8)) & 255) + (1 - alpha) * ((s >>> shift) & 255));
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The mirror of the web `text on a tint` sweep. `accentSoft` is a 12%-alpha gold,
 * so the ground under a due chip or the streak pill is the tint composited onto
 * the surface — lighter than either token alone. Read against the opaque tokens
 * only, `accentStrong` looked fine at 5.4:1 while the chips rendered at 4.4.
 */
describe('text on the gold tint', () => {
  it.each([
    ['light', light],
    ['dark', dark],
  ])('keeps accentStrong at 4.5:1 on accentSoft in %s', (_name, theme) => {
    const failures: string[] = [];
    for (const surface of [theme.bg, theme.surface, theme.card, theme.well, theme.cellbg, theme.pairbg]) {
      const ground = blend(theme.accentSoft, surface);
      const ratio = contrast(theme.accentStrong, ground);
      if (ratio < 4.5) failures.push(`accentStrong on ${ground}: ${ratio.toFixed(2)}`);
    }
    expect(failures).toEqual([]);
  });
});

// The three primary actions map straight onto the Coach action tokens; the rest are
// palette-derived. Both themes are checked so the mapping tracks light/dark.
describe('action colors', () => {
  it('maps raise/threeBet onto the Coach action tokens', () => {
    for (const theme of [light, dark]) {
      const map = actionColors(theme);
      expect(map.raise).toBe(theme.raise);
      expect(map.threeBet).toBe(theme.bet3);
    }
  });

  it('covers every RangeAction with a distinct fill', () => {
    const map = actionColors(light);
    const keys = Object.keys(map);
    expect(keys).toEqual(['fold', 'call', 'raise', 'threeBet', 'fourBet', 'jam', 'mixed']);
    expect(new Set(Object.values(map)).size).toBe(keys.length);
  });

  // The web mirror of these two lives in `src/cssIntegrity.test.ts`. An action fill
  // has two jobs and had been failing the second: the grid cell has to read as
  // assigned (3:1 from an unassigned one), and the hand label printed on it has to
  // stay readable. Every fill carried `onAccent`, which on the light palette's
  // darker fills ran 2.3–4.0:1 — the label was the darkest thing on a dark tile.
  it.each([
    ['light', light],
    ['dark', dark],
  ])('keeps an assigned cell 3:1 from an unassigned one in %s', (_name, theme) => {
    const failures: string[] = [];
    for (const [action, fill] of Object.entries(actionColors(theme))) {
      const ratio = contrast(fill, theme.cellbg);
      if (ratio < 3) failures.push(`${action} (${fill}) on cellbg: ${ratio.toFixed(2)}`);
    }
    expect(failures).toEqual([]);
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ])('keeps the label readable on every action fill in %s', (_name, theme) => {
    const failures: string[] = [];
    for (const [action, fill] of Object.entries(actionColors(theme))) {
      const ratio = contrast(theme.onAction, fill);
      if (ratio < 4.5) failures.push(`onAction on ${action} (${fill}): ${ratio.toFixed(2)}`);
    }
    expect(failures).toEqual([]);
  });
});
