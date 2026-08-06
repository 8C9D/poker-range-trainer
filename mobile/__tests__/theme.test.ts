import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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
 * The mirror of the web `drill answers` guard. A drill asks which of two answers
 * is right, so neither may wear `goldFill` — the "single primary action" fill.
 * It sat on the yes button, promoting one side of the judgement being measured,
 * and a nudged miss is recorded as a false positive that feeds the leak report
 * and the review schedule. "Next" replaces both answers, so it keeps the fill.
 */
describe('drill answers', () => {
  const drills = ['RecognitionDrill'].map((name) => ({
    name,
    source: readFileSync(join(__dirname, '..', 'components', 'practice', `${name}.tsx`), 'utf8'),
  }));

  it.each(drills)('leaves $name’s two answers evenly weighted', ({ source }) => {
    const goldStyles = [...source.matchAll(/(\w+):\s*\{[^}]*theme\.goldFill[^}]*\}/g)].map(
      (match) => match[1],
    );
    expect(goldStyles).toEqual(['answerNext']);
  });
});

/**
 * The palette carries two golds and only one of them is ink: `accent` is the
 * border/outline gold, sized for the 3:1 a component boundary answers to, and
 * `accentStrong` is the same hue taken down to text contrast. The web app keeps
 * them apart; this port had put `accent` on about thirty labels, links, counts
 * and statuses, every one of them landing near 3.1–3.7:1 in light mode.
 */
describe('the two golds', () => {
  const sources = readdirSync(join(__dirname, '..'), { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.tsx') && !entry.startsWith('node_modules'))
    .map((entry) => ({ entry, source: readFileSync(join(__dirname, '..', entry), 'utf8') }));

  it('reads the whole app', () => {
    // Guards the guard: an empty sweep would pass no matter what the styles say.
    expect(sources.length).toBeGreaterThan(40);
  });

  it('never sets accent as a text color', () => {
    // Only a style key literally named `color` matches; `borderColor` capitalizes.
    const offenders = sources
      .filter(({ source }) => /(?<![\w-])color:\s*theme\.accent(?![A-Za-z])/.test(source))
      .map(({ entry }) => entry);
    expect(offenders).toEqual([]);
  });

  it('still uses accent for the borders it is sized for', () => {
    // Most accent-bordered chips left with the archived editors; the swipe
    // affordance in the recognition drill is the one that remains.
    const borders = sources.filter(({ source }) =>
      /borderColor:[^,;\n]*theme\.accent(?![A-Za-z])/.test(source),
    );
    expect(borders.length).toBeGreaterThan(0);
  });
});

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
