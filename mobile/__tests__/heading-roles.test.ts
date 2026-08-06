import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * VoiceOver's rotor can only jump between headings that are marked as headings.
 * A `<Text>` styled like a title but left without `accessibilityRole="header"`
 * looks right and reads as ordinary prose, so the only way to reach the next
 * section is to swipe through every control in this one.
 *
 * The web app gets this for free from `<h1>`/`<h2>`; RN has no element to infer
 * it from, so each title has to opt in and each new screen is a fresh chance to
 * forget. This sweeps the sources instead of relying on remembering.
 */

const ROOT = join(__dirname, '..');

/** Style names this project uses for a section or screen title. */
const TITLE_STYLES = /^(heading|sectionTitle|sectionHeading|cardTitle|title|rangeName)$/;

/**
 * Text that carries a title style but is deliberately not a heading. Each entry
 * is a `file:styleName` the sweep skips, with the reason it is not one.
 */
const NOT_HEADINGS = new Map([
  // The practice chrome's truncated caption, next to the close button and the
  // progress bar. The web mirror is the dialog's aria-label, not a heading.
  ['components/practice/OverlayFrame.tsx:title', 'drill chrome, not a section title'],
]);

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry: string) => {
    if (entry === 'node_modules' || entry === '__tests__') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourcesUnder(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

describe('screen and section titles', () => {
  it('marks every title as a heading for the VoiceOver rotor', () => {
    const files = [...sourcesUnder(join(ROOT, 'app')), ...sourcesUnder(join(ROOT, 'components'))];
    // Guards the guard: an empty sweep would pass no matter what the sources say.
    expect(files.length).toBeGreaterThan(20);

    const unmarked: string[] = [];
    for (const file of files) {
      const relative = file.slice(ROOT.length + 1);
      const source = readFileSync(file, 'utf8');
      // Each <Text …> opening tag, up to the closing angle bracket of the tag.
      for (const tag of source.matchAll(/<Text\b[^>]*>/g)) {
        const style = /style=\{(?:\[)?styles\.(\w+)/.exec(tag[0]);
        if (!style || !TITLE_STYLES.test(style[1])) continue;
        if (NOT_HEADINGS.has(`${relative}:${style[1]}`)) continue;
        if (!tag[0].includes('accessibilityRole="header"')) {
          unmarked.push(`${relative}: styles.${style[1]}`);
        }
      }
    }

    expect(unmarked).toEqual([]);
  });

  it('keeps the exception list honest', () => {
    // An exception for a style that no longer exists silently stops covering
    // anything, so it has to be removed rather than left to rot.
    for (const [entry] of NOT_HEADINGS) {
      const [relative, style] = entry.split(':');
      const source = readFileSync(join(ROOT, relative), 'utf8');
      expect(source).toContain(`styles.${style}`);
    }
  });
});
