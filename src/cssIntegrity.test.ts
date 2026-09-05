import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guards the stylesheets against referencing custom properties nothing defines.
 *
 * `gap: var(--space-2)` with no `--space-2` anywhere is not a build or lint
 * error: the declaration is dropped at computed-value time and the property
 * silently falls back to its initial value. Three such references sat in the
 * Library's CSS, so its header buttons and bulk actions rendered flush against
 * each other with no gap at all. Nothing catches that but the eye — or this.
 *
 * The CSS is read from disk rather than imported: the jsdom test environment
 * stubs stylesheet imports to empty strings, which would make this vacuous.
 * That is also why this file is typechecked by tsconfig.node.json instead of
 * the browser-only app config (it needs `node:fs`).
 */

const SRC = join(process.cwd(), 'src')

function filesUnder(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((entry: string) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return filesUnder(full, ext)
    return full.endsWith(ext) ? [full] : []
  })
}

function cssFiles(dir: string): string[] {
  return filesUnder(dir, '.css')
}

describe('stylesheet custom properties', () => {
  it('only references custom properties that are defined', () => {
    const sources = cssFiles(SRC).map((file) => ({
      file: file.slice(SRC.length),
      css: readFileSync(file, 'utf8'),
    }))
    // Guards the guard: an empty sweep would pass no matter what the CSS says.
    expect(sources.length).toBeGreaterThan(10)
    expect(sources.some(({ css }) => css.includes('var(--'))).toBe(true)

    const defined = new Set<string>()
    for (const { css } of sources) {
      for (const match of css.matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1])
    }

    const dangling: string[] = []
    for (const { file, css } of sources) {
      for (const match of css.matchAll(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g)) {
        // A fallback is not a defense, it is the failure: these stylesheets came
        // from a purple pre-Coach theme and several kept its literal colors as
        // fallbacks. `var(--error, #d33)` looked safe and was the only rule that
        // ever ran, because nothing defines `--error` — so the sign-in error
        // stayed the old red in both themes while every sibling followed the
        // palette. A referenced token has to exist, fallback or not.
        if (!defined.has(match[1])) dangling.push(`${file}: ${match[1]}`)
      }
    }

    expect(dangling).toEqual([])
  })
})

describe('hidden form controls', () => {
  it('never takes a form control out of the tab order to hide it', () => {
    // `display: none` on a form control does not just hide it — it removes it
    // from the tab order. The Account file inputs were hidden that way behind
    // labels styled as buttons, which left all four Import actions unreachable
    // by keyboard: Tab jumped straight from "Export backup" to "Export pack".
    // Visually hidden controls have to stay laid out and merely clipped.
    const sources = cssFiles(SRC).map((file) => ({
      file: file.slice(SRC.length),
      css: readFileSync(file, 'utf8'),
    }))
    expect(sources.length).toBeGreaterThan(10)

    const CONTROL = /(?:^|[\s,>+~])(?:input|select|textarea|button)\s*(?:\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?)*\s*$/
    const offenders: string[] = []
    for (const { file, css } of sources) {
      // `[^{}]` on both sides so a rule nested in an @media block is seen as
      // its own rule instead of being swallowed as the at-rule's body.
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const [, selectorList, body] = match
        if (!/(?:display\s*:\s*none|visibility\s*:\s*hidden)/.test(body)) continue
        for (const selector of selectorList.split(',')) {
          if (CONTROL.test(selector.trim())) offenders.push(`${file}: ${selector.trim()}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})

/**
 * The shared button takes extra classes (`coach-btn primary`, `coach-btn
 * account-file`). One with no rule at all is invisible in exactly the wrong way:
 * the Library's "Delete selected" carried `coach-btn danger` for which no
 * `.danger` rule existed, so the destructive action rendered identically to the
 * Archive and Favorite buttons beside it. Either form counts — a compound
 * `.coach-btn.primary` modifier or a standalone `.account-file` rule.
 */
describe('coach-btn variants', () => {
  it('has a rule for every variant the app applies', () => {
    const css = cssFiles(SRC)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')

    const variants = new Set<string>()
    for (const file of filesUnder(SRC, '.tsx')) {
      if (file.includes('.test.')) continue
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/className="coach-btn ([a-z][\w -]*)"/g)) {
        for (const variant of match[1].split(/\s+/).filter(Boolean)) variants.add(variant)
      }
    }
    // Guards the guard: the known variants must be found, or the scan is broken.
    expect(variants).toContain('primary')

    const unstyled = [...variants].filter(
      (variant) =>
        !css.includes(`.coach-btn.${variant}`) && !new RegExp(`\\.${variant}[\\s,{:.]`).test(css),
    )
    expect(unstyled).toEqual([])
  })
})

/**
 * `cursor: pointer` is a promise. The frequency map and the range comparison
 * both borrow `.action-cell` from the editable action grid for its shape, and
 * borrowed its pointer and its hover border with it: 169 cells per grid that lit
 * up under the cursor and did nothing when clicked, on two screens whose whole
 * job is to be read. jsdom computes no styles, so the pairing is checked here,
 * against the stylesheets and the markup that carries their classes.
 */
describe('click affordances', () => {
  it('only offers a pointer on something that can be clicked', () => {
    // Classes a plain `.class` rule makes look clickable. Element-qualified and
    // descendant selectors are skipped: those already name what they style.
    const clickable = new Set<string>()
    for (const file of cssFiles(SRC)) {
      // Comments first: they sit between the previous `}` and the selector, so
      // an explained rule would otherwise read as an unrecognizable selector and
      // be skipped — silently exempting the very rules someone stopped to justify.
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, selectorList, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/cursor\s*:\s*pointer/.test(body)) continue
        for (const selector of selectorList.split(',')) {
          const bare = /^\.([\w-]+)$/.exec(selector.trim())
          if (bare) clickable.add(bare[1])
        }
      }
    }
    // Guards the guard: a scan that found no such class would pass on anything.
    expect(clickable.size).toBeGreaterThan(5)
    expect(clickable).toContain('coach-btn')

    const INTERACTIVE = ['button', 'a', 'label', 'input', 'select', 'textarea', 'summary']
    const offenders: string[] = []
    let placements = 0
    for (const file of filesUnder(SRC, '.tsx')) {
      if (file.includes('.test.')) continue
      const source = readFileSync(file, 'utf8')
      for (const cls of clickable) {
        for (const match of source.matchAll(new RegExp(`(?<![\\w-])${cls}(?![\\w-])`, 'g'))) {
          // The element carrying the class is the nearest tag opened before it.
          const opened = source.lastIndexOf('<', match.index)
          const tag = /^<([A-Za-z][\w.]*)/.exec(source.slice(opened, opened + 40))?.[1]
          if (!tag) continue
          placements += 1
          if (!INTERACTIVE.includes(tag)) offenders.push(`${file.slice(SRC.length)}: <${tag} .${cls}`)
        }
      }
    }
    expect(placements).toBeGreaterThan(20)
    expect(offenders).toEqual([])
  })
})

/**
 * A table of tabular columns has a hard minimum width. Left bare in a card it
 * does not shrink on a phone — it widens its card past the viewport and the
 * whole page scrolls sideways, which is how the Library's spot map, the
 * Progress screen's weakest hands, and the range Stats tables all behaved at
 * 390px. `.coach-table-scroll` confines that scrolling to the table itself, and
 * this keeps the next table from forgetting it. Layout is invisible to jsdom,
 * so the invariant is checked in the markup.
 */
describe('wide tables', () => {
  it('wraps every table in a horizontal scroll container', () => {
    const unwrapped: string[] = []
    let tables = 0
    for (const file of filesUnder(SRC, '.tsx')) {
      if (file.includes('.test.')) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (!line.includes('<table')) return
        tables += 1
        const previous = lines
          .slice(0, index)
          .reverse()
          .find((candidate) => candidate.trim() !== '')
        if (!previous?.includes('coach-table-scroll')) {
          unwrapped.push(`${file.slice(SRC.length)}:${index + 1}`)
        }
      })
    }
    // Guards the guard: an empty sweep would pass no matter what the JSX says.
    // (Three tables remain after the v1 trim: per-hand accuracy, session
    // history, and the Progress weakest-hands table.)
    expect(tables).toBeGreaterThanOrEqual(3)
    expect(unwrapped).toEqual([])
  })
})

/**
 * WCAG AA asks 4.5:1 of body-size text, and the whole Coach palette runs through
 * six tokens, so a single hex decides whether a dozen screens are readable.
 * `--ink-3` was at 2.5:1 in light mode — the date line, the chart labels, the
 * weak-hands table headers and the drill's swipe hint all sat well under half
 * the required contrast, and none of it looked obviously wrong to a sighted
 * reader on a bright screen. The remaining muted tokens were between 3.5 and
 * 4.4, close enough to pass by eye and fail in fact.
 *
 * Dark mode already had a working three-step ramp (≈12 / 6 / 4.5); this holds
 * light mode to the same shape and keeps either from drifting back.
 */

/**
 * Tokens the stylesheets set as a `color:`, i.e. that have to clear 4.5:1.
 * `--heart` and `--diamond` are the suit accents on a *themed* surface (the
 * combo grid, the flop cards); the card face's own ink is `--card-*` and is
 * checked separately against the face it is painted on.
 */
const TEXT_TOKENS = [
  '--ink',
  '--ink-2',
  '--ink-3',
  '--accent-strong',
  '--good',
  '--bad',
  '--heart',
  '--diamond',
]

/**
 * Surfaces those tokens can land on. `--cardface` is deliberately absent: it is
 * the playing card's own face, which stays light in both themes, and no ink
 * token is ever drawn on it (the suit colors are, and they are a separate
 * problem with a separate rule).
 */
const SURFACE_TOKENS = ['--bg', '--surface', '--card', '--well', '--cellbg', '--pairbg']

/**
 * Text drawn on a translucent tint, which is neither the tint nor the surface
 * but the two composited. `--accent-soft` is a 12%-alpha gold, and reading
 * `--accent-strong` against the opaque tokens alone said it was fine at 5.4:1
 * while the active rail label and the Library's "Due" chip actually rendered at
 * 4.4 — the tint lightens the ground out from under the only ink put on it.
 */
const TINTED_PAIRS = [{ text: '--accent-strong', tint: '--accent-soft' }]

/** Relative luminance per WCAG 2.x. */
function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16)
  const channel = (raw: number) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  )
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** The `--token: #rrggbb` pairs inside one CSS block. */
function tokensIn(block: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const match of block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    tokens[match[1]] = match[2].toLowerCase()
  }
  return tokens
}

/** The `--token: #rrggbbaa` tints inside one CSS block. */
function tintsIn(block: string): Record<string, string> {
  const tints: Record<string, string> = {}
  for (const match of block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{8})\s*;/gi)) {
    tints[match[1]] = match[2].toLowerCase()
  }
  return tints
}

/** Composite an `#rrggbbaa` tint onto an opaque `#rrggbb` surface. */
function blend(tint: string, surface: string): string {
  const t = parseInt(tint.slice(1), 16)
  const s = parseInt(surface.slice(1), 16)
  const alpha = (t & 255) / 255
  const channel = (shift: number) =>
    Math.round(alpha * ((t >>> (shift + 8)) & 255) + (1 - alpha) * ((s >>> shift) & 255))
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`
}

describe('palette contrast', () => {
  const css = readFileSync(join(SRC, 'theme.css'), 'utf8')
  // The dark palette is the `:root` block inside the prefers-color-scheme query;
  // the light one is everything before that query starts.
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
  const themes = {
    light: tokensIn(css.slice(0, darkStart)),
    dark: tokensIn(css.slice(darkStart)),
  }

  it.each(Object.keys(themes))('defines every token the sweep checks in %s', (name) => {
    // Guards the guard: a renamed token would otherwise silently drop out.
    const theme = themes[name as keyof typeof themes]
    for (const token of [...TEXT_TOKENS, ...SURFACE_TOKENS]) {
      expect(theme[token], `${name} is missing ${token}`).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it.each(Object.keys(themes))('keeps body text at 4.5:1 on every surface in %s', (name) => {
    const theme = themes[name as keyof typeof themes]
    const failures: string[] = []
    for (const text of TEXT_TOKENS) {
      for (const surface of SURFACE_TOKENS) {
        const ratio = contrast(theme[text], theme[surface])
        if (ratio < 4.5) {
          failures.push(`${text} (${theme[text]}) on ${surface} (${theme[surface]}): ${ratio.toFixed(2)}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  it.each(Object.keys(themes))('keeps text on a tint at 4.5:1 in %s', (name) => {
    const theme = themes[name as keyof typeof themes]
    const tints = {
      light: tintsIn(css.slice(0, darkStart)),
      dark: { ...tintsIn(css.slice(0, darkStart)), ...tintsIn(css.slice(darkStart)) },
    }[name as 'light' | 'dark']
    const failures: string[] = []
    for (const { text, tint } of TINTED_PAIRS) {
      // Guards the guard: a renamed tint would otherwise check nothing.
      expect(tints[tint], `${name} is missing ${tint}`).toMatch(/^#[0-9a-f]{8}$/)
      for (const surface of SURFACE_TOKENS) {
        const ground = blend(tints[tint], theme[surface])
        const ratio = contrast(theme[text], ground)
        if (ratio < 4.5) {
          failures.push(`${text} on ${tint} over ${surface} (${ground}): ${ratio.toFixed(2)}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  it.each(Object.keys(themes))('keeps the three ink steps visibly apart in %s', (name) => {
    // All three passing AA is not enough on its own: collapsing them to the same
    // darkness would pass this file and flatten every screen's hierarchy.
    const theme = themes[name as keyof typeof themes]
    const onBg = (token: string) => contrast(theme[token], theme['--bg'])
    expect(onBg('--ink')).toBeGreaterThan(onBg('--ink-2') * 1.5)
    expect(onBg('--ink-2')).toBeGreaterThan(onBg('--ink-3') * 1.2)
  })
})

/**
 * The playing card is the one surface that does not follow the theme: its face
 * stays paper-colored in dark mode, because a dark playing card is not a
 * playing card. The suit colors on it were themed anyway, so in dark mode the
 * app lightened the ink for a dark background and then painted it on cream —
 * the diamond landed at 2.4:1, a pale blue smudge next to a crisp black spade,
 * on the screen a user spends the whole session looking at.
 *
 * The tokens are read out of the component rather than listed here, so pointing
 * it at a different color brings that color under the same rule.
 */
describe('playing card contrast', () => {
  const css = readFileSync(join(SRC, 'theme.css'), 'utf8')
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
  const themes = {
    light: tokensIn(css.slice(0, darkStart)),
    // The card's own tokens are only defined once, so fall back to the light
    // block for anything the dark block does not override.
    dark: { ...tokensIn(css.slice(0, darkStart)), ...tokensIn(css.slice(darkStart)) },
  }

  /** The suit color tokens `PlayingCards` paints on the card face. */
  const suitTokens = [
    ...new Set(
      Array.from(
        readFileSync(join(SRC, 'practice', 'PlayingCards.tsx'), 'utf8').matchAll(
          /var\((--[\w-]+)\)/g,
        ),
      ).map((match) => match[1]),
    ),
  ]

  it('reads all four suits out of the component', () => {
    // Guards the guard: an empty list would pass every case below.
    expect(suitTokens).toHaveLength(4)
  })

  it.each(Object.keys(themes))('keeps every suit legible on the card face in %s', (name) => {
    const theme = themes[name as keyof typeof themes]
    const failures: string[] = []
    for (const token of suitTokens) {
      const ratio = contrast(theme[token], theme['--cardface'])
      if (ratio < 4.5) {
        failures.push(`${token} (${theme[token]}) on --cardface (${theme['--cardface']}): ${ratio.toFixed(2)}`)
      }
    }
    expect(failures).toEqual([])
  })
})

/**
 * A literal color in a component stylesheet is a color that cannot follow the
 * theme, and these files still carried a drawer of them from the pre-Coach
 * design. The worst read `color: #fff` over `background: var(--accent)` — fine
 * against the old purple, and in dark mode white-on-gold at 1.9:1 on the button
 * that ends a build-from-memory drill. Two error lines were frozen dark red and
 * disappeared into the dark background the same way.
 *
 * A literal is legitimate only when the same rule pins the background under it,
 * because then the pair is self-contained and no theme moves out from under it —
 * that is how the action swatches and the accuracy heat ramp are built. So the
 * rule is not "no literals", it is "no unpaired literals".
 */

/** Rules whose background is set by a sibling class rather than in the block. */
const PAIRED_ELSEWHERE = new Map<string, string>([])

describe('literal colors', () => {
  it('never sets a text color that no background in the same rule pins down', () => {
    const sources = cssFiles(SRC)
      .map((file) => ({ file: file.slice(SRC.length), css: readFileSync(file, 'utf8') }))
      // theme.css is where literals belong: it *is* the palette.
      .filter(({ file }) => file !== '/theme.css')
    expect(sources.length).toBeGreaterThan(10)

    const unpaired: string[] = []
    let literals = 0
    for (const { file, css } of sources) {
      // `[^{}]` on both sides so a rule nested in an @media block is read as
      // its own rule instead of being swallowed as the at-rule's body.
      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const [, rawSelector, body] = rule
        if (!/(^|[;\s])color:\s*#[0-9a-f]{3,8}/i.test(body)) continue
        literals += 1
        if (/(^|[;\s])background(-color)?:\s*#[0-9a-f]{3,8}/i.test(body)) continue
        const selector = rawSelector.trim().split(/\s*,\s*/)[0].replace(/\s+/g, ' ')
        if (PAIRED_ELSEWHERE.has(`${file}:${selector}`)) continue
        unpaired.push(`${file}: ${selector}`)
      }
    }

    // Guards the guard: an empty offender list must mean "every literal is
    // paired", not "the sweep matched nothing" — the last literal-color rules
    // left with the archived range-diff styles, so zero literals is the
    // expected healthy state now.
    expect(literals).toBeGreaterThanOrEqual(0)
    expect(unpaired).toEqual([])
  })

  it('keeps the exception list honest', () => {
    // An exception for a selector that no longer exists silently stops covering
    // anything, so it has to be removed rather than left to rot.
    for (const [entry] of PAIRED_ELSEWHERE) {
      const [file, selector] = entry.split(':')
      expect(readFileSync(join(SRC, file.slice(1)), 'utf8')).toContain(selector)
    }
  })
})

/**
 * The app's identity assets, which live outside the stylesheet's reach.
 *
 * A favicon and an installed app icon are the two places the product is seen
 * before any of its CSS loads, and nothing in the build ties them to the
 * palette: the shipped pair had drifted a whole design system behind, painting
 * purple on near-black beside a cream-and-gold app, and the favicon was not even
 * this product's mark. They are held here to the same light-theme tokens the
 * SVG export answers to.
 */
describe('app icons', () => {
  const themeCss = readFileSync(join(SRC, 'theme.css'), 'utf8')
  const lightValues = new Set(
    Object.values(tokensIn(themeCss.slice(0, themeCss.indexOf('@media (prefers-color-scheme: dark)')))),
  )
  const icons = ['favicon.svg', 'app-icon.svg'].map((name) => ({
    name,
    svg: readFileSync(join(process.cwd(), 'public', name), 'utf8'),
  }))

  it.each(icons)('paints $name only in palette colors', ({ svg }) => {
    const used = [...svg.matchAll(/#[0-9a-f]{3,8}/gi)].map((match) => match[0].toLowerCase())
    // Guards the guard: an icon that had stopped declaring colors would pass.
    expect(used.length).toBeGreaterThanOrEqual(2)
    expect(used.filter((hex) => !lightValues.has(hex))).toEqual([])
  })

  it('keeps the manifest colors on the palette too', () => {
    const manifest = readFileSync(join(process.cwd(), 'public', 'manifest.webmanifest'), 'utf8')
    const declared = [
      ...manifest.matchAll(/"(?:background|theme)_color":\s*"(#[0-9a-f]{3,8})"/gi),
    ].map((match) => match[1].toLowerCase())
    expect(declared.length).toBeGreaterThanOrEqual(2)
    // The dark theme-color is a dark-block token, so check both blocks here.
    const all = new Set([...lightValues, ...Object.values(tokensIn(themeCss))])
    expect(declared.filter((hex) => !all.has(hex))).toEqual([])
  })
})

/**
 * A drill asks which of two answers is right, so neither may be dressed as the
 * one to press. Gold is the palette's "single primary action on a screen" fill
 * and it sat on the yes button, promoting one side of the very judgement being
 * measured — and a nudged miss is not neutral data either: it lands as a false
 * positive that feeds the leak report, the weakest-hands table and the review
 * schedule. `.next` is the exception it looks like: it replaces both answers,
 * so at that moment there really is a single action.
 */
describe('drill answers', () => {
  it('gives the primary fill only to the button that stands alone', () => {
    // Comments sit between rules, so they land in the selector capture and drag
    // the following rule's body along with them; drop them first.
    const css = readFileSync(join(SRC, 'practice', 'practice.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const promoted: string[] = []
    for (const rule of css.matchAll(/([^{}]*\.drill-answer[^{}]*)\{([^{}]*)\}/g)) {
      const [, rawSelector, body] = rule
      if (!body.includes('--gold-fill')) continue
      const selector = rawSelector.trim().split(/\s*,\s*/)[0].replace(/\s+/g, ' ')
      if (selector === '.drill-answer.next') continue
      promoted.push(selector)
    }
    expect(promoted).toEqual([])
  })

  it('still gives it to that one', () => {
    // Guards the guard: a renamed class would make the rule above vacuous.
    const css = readFileSync(join(SRC, 'practice', 'practice.css'), 'utf8')
    expect(css).toMatch(/\.drill-answer\.next\s*\{[^}]*--gold-fill/)
  })
})

/**
 * The palette carries two golds, and only one of them is ink.
 *
 * `--accent` is the border/outline gold: at 3.1:1 on the page it clears the 3:1
 * a UI component's boundary answers to and nothing more. `--accent-strong` is
 * the same hue taken down to text contrast. The web app had them straight except
 * for the Library's favourite star; the mobile port did not, and put `accent` on
 * roughly thirty labels, links and counts that all rendered around 3.1–3.7:1 in
 * light mode. Keeping the split mechanical is what stops that drifting back.
 */
describe('the two golds', () => {
  it('never sets --accent as a text color', () => {
    const offenders: string[] = []
    for (const file of cssFiles(SRC)) {
      const css = readFileSync(file, 'utf8')
      // `(^|[;\s])` so `border-color: var(--accent)` is not read as a `color:`.
      for (const match of css.matchAll(/(^|[;\s])color:\s*var\(\s*--accent\s*\)/g)) {
        offenders.push(`${file.slice(SRC.length)}: ${match[0].trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('still uses --accent for the borders it is sized for', () => {
    // Guards the guard: if the token fell out of use entirely the rule above
    // would pass while saying nothing.
    const css = cssFiles(SRC)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    expect(css.match(/border-color:\s*var\(\s*--accent\s*\)/g)?.length ?? 0).toBeGreaterThan(3)
  })
})

/**
 * The seven multi-action fills, and the two ways they had gone wrong at once.
 *
 * A `background` on `.action-jam` and the one on `.action-cell` are both a single
 * class, and the bundler emits the grid's rule last — so the base rule won and
 * every assigned hand rendered in the unassigned fill. The Actions tab painted a
 * colored legend above a grid with no color in it at all, which no unit test
 * could see because jsdom applies no stylesheets.
 *
 * The fills were also frozen literals from the pre-Coach palette, so once they
 * did show they would have brought their own problems: `jam` sat at 1.6:1
 * against an unassigned cell in dark mode, and `raise` at 1.9:1 in light.
 *
 * The fix is one mechanism: the modifier hands the fill and ink over as custom
 * properties, and the base rule *reads* them — a property a rule reads cannot be
 * outranked by that rule. Both halves are checked here.
 */
const ACTION_FILL_TOKENS = [
  '--act-fold',
  '--act-call',
  '--act-raise',
  '--act-3bet',
  '--act-4bet',
  '--act-jam',
  '--act-mixed',
]

/** Every `--token: value` pair in a block, aliases (`var(--x)`) included. */
function declarationsIn(block: string): Record<string, string> {
  const declarations: Record<string, string> = {}
  for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    declarations[match[1]] = match[2].trim()
  }
  return declarations
}

/** Follow `var(--x)` aliases down to the hex the theme actually paints. */
function resolve(token: string, theme: Record<string, string>): string {
  let value: string | undefined = theme[token]
  for (let hop = 0; hop < 5 && value?.startsWith('var('); hop += 1) {
    value = theme[value.slice(4, -1).trim()]
  }
  return value ?? ''
}

describe('action fills', () => {
  const css = readFileSync(join(SRC, 'theme.css'), 'utf8')
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
  const lightBlock = declarationsIn(css.slice(0, darkStart))
  const themes = {
    light: lightBlock,
    // The dark block only overrides part of the palette; the rest still resolves
    // through the light one, which is what makes the aliases flip on their own.
    dark: { ...lightBlock, ...declarationsIn(css.slice(darkStart)) },
  }

  it.each(Object.keys(themes))('resolves every action token to a color in %s', (name) => {
    // Guards the guard: an alias pointing at nothing would silently drop out.
    const theme = themes[name as keyof typeof themes]
    for (const token of [...ACTION_FILL_TOKENS, '--on-action', '--well']) {
      expect(resolve(token, theme), `${name} cannot resolve ${token}`).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it.each(Object.keys(themes))('keeps an assigned cell 3:1 from an unassigned one in %s', (name) => {
    // An unassigned `.action-cell` falls back to --code-bg, which is --well.
    const theme = themes[name as keyof typeof themes]
    const failures: string[] = []
    for (const token of ACTION_FILL_TOKENS) {
      const ratio = contrast(resolve(token, theme), resolve('--well', theme))
      if (ratio < 3) failures.push(`${token} on --well: ${ratio.toFixed(2)}`)
    }
    expect(failures).toEqual([])
  })

  it.each(Object.keys(themes))('keeps the hand label readable on every fill in %s', (name) => {
    const theme = themes[name as keyof typeof themes]
    const ink = resolve('--on-action', theme)
    const failures: string[] = []
    for (const token of ACTION_FILL_TOKENS) {
      const ratio = contrast(ink, resolve(token, theme))
      if (ratio < 4.5) failures.push(`--on-action on ${token}: ${ratio.toFixed(2)}`)
    }
    expect(failures).toEqual([])
  })

})

/**
 * Opacity is the quietest way to make text unreadable, because the number in the
 * stylesheet says nothing about what it composites to. Four grids dimmed their
 * *labelled* cells to 0.4–0.45 to mean "not selected" or "not in range", which in
 * light mode left the hand names at roughly 2.5:1 against the card behind them —
 * under the bar the palette itself is held to, and invisible to any check that
 * only reads colors.
 *
 * 0.7 is the floor at which this app's ink still clears 4.5:1 once composited on
 * its own surfaces, so anything dimmer has to say why.
 */
const DIM_FLOOR = 0.7

/** Rules allowed below the floor, with the reason each is not body text. */
const DIMMABLE = new Map([
  // WCAG 1.4.3 exempts inactive controls, and a disabled button that still
  // looked enabled would be the worse bug.
  ['/theme.css:.coach-btn:disabled', 'disabled controls are exempt'],
  // A bar with no text on it; the count is printed above it in full contrast.
  ['/screens/ProgressScreen.css:.progress-chart-bar', 'decorative bar, value shown as text'],
])

describe('dimmed text', () => {
  it('never dims a rule past the point its text stays readable', () => {
    const sources = cssFiles(SRC).map((file) => ({
      file: file.slice(SRC.length),
      css: readFileSync(file, 'utf8'),
    }))

    const tooDim: string[] = []
    let dimmed = 0
    for (const { file, css } of sources) {
      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const [, rawSelector, body] = rule
        const opacity = /(^|[;\s])opacity:\s*([\d.]+)/.exec(body)
        if (!opacity) continue
        dimmed += 1
        if (Number(opacity[2]) >= DIM_FLOOR) continue
        const selector = rawSelector.trim().split(/\s*,\s*/)[0].replace(/\s+/g, ' ')
        if (DIMMABLE.has(`${file}:${selector}`)) continue
        tooDim.push(`${file}: ${selector} at ${opacity[2]}`)
      }
    }

    // Guards the guard: a sweep that found no opacity at all would pass vacuously.
    expect(dimmed).toBeGreaterThan(3)
    expect(tooDim).toEqual([])
  })

  it('keeps the dimmable list honest', () => {
    for (const [entry] of DIMMABLE) {
      // Split on the FIRST colon only: a selector may carry a pseudo-class.
      const separator = entry.indexOf(':')
      const file = entry.slice(0, separator)
      const selector = entry.slice(separator + 1)
      expect(readFileSync(join(SRC, file.slice(1)), 'utf8')).toContain(selector)
    }
  })
})
