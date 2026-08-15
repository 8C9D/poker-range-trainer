import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Every gesture builder must declare `.runOnJS(true)`.
 *
 * With Worklets installed, react-native-gesture-handler runs gesture callbacks
 * on the UI runtime, where calling a plain JS function throws
 * "[Worklets] Tried to synchronously call a Remote Function" - and in a release
 * build that uncaught JSError aborts the process. Neither the web app (no
 * worklets) nor Jest (RNGH mock runs callbacks on the JS thread) can see this,
 * so the first place it surfaced was a hard crash on a real device
 * (2026-08-15, the first TestFlight session). This sweeps the sources the same
 * way heading-roles does, because each new gesture is a fresh chance to forget.
 */

const ROOT = join(__dirname, '..');

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry: string) => {
    if (entry === 'node_modules' || entry === '__tests__') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourcesUnder(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

describe('gesture builders', () => {
  it('runs every gesture callback on the JS thread via .runOnJS(true)', () => {
    const files = [...sourcesUnder(join(ROOT, 'app')), ...sourcesUnder(join(ROOT, 'components'))];
    // Guards the guard: an empty sweep would pass no matter what the sources say.
    expect(files.length).toBeGreaterThan(20);

    const offenders: string[] = [];
    let gestures = 0;
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      // Each `Gesture.<Kind>()` builder chain, up to the closing of its useMemo
      // or statement; the chain must contain `.runOnJS(true)` somewhere.
      for (const match of source.matchAll(/Gesture\.[A-Z]\w*\(\)[\s\S]{0,2000}?(?=,\s*\[|;\n)/g)) {
        gestures += 1;
        if (!match[0].includes('.runOnJS(true)')) {
          offenders.push(`${file.slice(ROOT.length + 1)}: ${match[0].slice(0, 60)}...`);
        }
      }
    }
    // Guards the guard again: the two known gestures must be seen by the sweep.
    expect(gestures).toBeGreaterThanOrEqual(2);
    expect(offenders).toEqual([]);
  });
});
