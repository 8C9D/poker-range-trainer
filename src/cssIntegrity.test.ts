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
        // A var() with a fallback still renders sensibly, so only bare ones count.
        if (match[0].includes(',')) continue
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
    expect(tables).toBeGreaterThanOrEqual(5)
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

/** Tokens the stylesheets set as a `color:`, i.e. that have to clear 4.5:1. */
const TEXT_TOKENS = ['--ink', '--ink-2', '--ink-3', '--accent-strong', '--good', '--bad']

/**
 * Surfaces those tokens can land on. `--cardface` is deliberately absent: it is
 * the playing card's own face, which stays light in both themes, and no ink
 * token is ever drawn on it (the suit colors are, and they are a separate
 * problem with a separate rule).
 */
const SURFACE_TOKENS = ['--bg', '--surface', '--card', '--well', '--cellbg', '--pairbg']

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

  it.each(Object.keys(themes))('keeps the three ink steps visibly apart in %s', (name) => {
    // All three passing AA is not enough on its own: collapsing them to the same
    // darkness would pass this file and flatten every screen's hierarchy.
    const theme = themes[name as keyof typeof themes]
    const onBg = (token: string) => contrast(theme[token], theme['--bg'])
    expect(onBg('--ink')).toBeGreaterThan(onBg('--ink-2') * 1.5)
    expect(onBg('--ink-2')).toBeGreaterThan(onBg('--ink-3') * 1.2)
  })
})
