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
