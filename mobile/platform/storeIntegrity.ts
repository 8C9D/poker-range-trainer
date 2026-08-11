import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Noticing data MMKV dropped, because nothing else will.
 *
 * `localStorageShim` opens the store with `recoveryStrategy: 'recover-on-error'`,
 * which turns a CRC or file-length error from "discard every key" into "salvage
 * what is readable". That is strictly better and still not the whole story: a
 * PARTIAL recovery drops whatever could not be salvaged, and every read
 * afterwards succeeds — the app just gets a smaller library back and renders the
 * survivors as though they were all there ever was.
 *
 * react-native-mmkv reports none of this. Its `Configuration` takes no error
 * callback and the `MMKV` instance exposes no recovery signal (v4.3.2:
 * `lib/specs/MMKVFactory.nitro.d.ts`, `lib/specs/MMKV.nitro.d.ts`), and it
 * registers no handler with MMKV core either. So the only way to know is for the
 * app to remember which keys it stored and notice when fewer come back.
 *
 * That record lives in a SECOND MMKV instance — a second file with its own CRC —
 * because keeping it in the main store would let one corruption event take both
 * the data and the evidence that the data ever existed.
 */

const INTEGRITY_STORE_ID = 'poker-range-trainer-integrity';
const INVENTORY_KEY = 'inventory';
const PENDING_LOSS_KEY = 'pending-loss';

/** Where a detected loss is reported to, if anywhere. */
type StorageLossReporter = (keys: string[]) => void;

let reporter: StorageLossReporter | null = null;
let unreported: string[] = [];

/**
 * Hand this module somewhere to report to — in practice `reportStorageLoss`,
 * wired up once Sentry has been initialised.
 *
 * Injected rather than imported, and not for testability: this module is reached
 * from the `localStorage` shim, which is installed on the entry file's first line
 * before anything else exists. Importing the crash-reporting seam from here would
 * drag the whole Sentry SDK into that first line, ahead of `Sentry.init` and
 * ahead of every screen. A detection that happens before a reporter arrives is
 * held and delivered when one does, so the wiring order cannot cost a report.
 */
export function setStorageLossReporter(report: StorageLossReporter): void {
  reporter = report;
  flushReports();
}

function flushReports(): void {
  if (reporter === null || unreported.length === 0) return;
  const keys = unreported;
  unreported = [];
  reporter(keys);
}

let integrityStore: MMKV | null = null;

function getIntegrityStore(): MMKV {
  integrityStore ??= createMMKV({
    id: INTEGRITY_STORE_ID,
    recoveryStrategy: 'recover-on-error',
  });
  return integrityStore;
}

/**
 * The last inventory written, so an ordinary value update — which changes what a
 * key holds but not which keys exist — costs no sidecar write at all.
 */
let writtenInventory: string | null = null;

function readKeyList(key: string): string[] {
  const raw = getIntegrityStore().getString(key);
  if (raw === undefined) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // The sidecar is an MMKV file too and can be damaged in its turn. Bookkeeping
    // we cannot read means "nothing known", never a reported loss: this code
    // exists to tell the user something true, so it must not invent one.
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is string => typeof entry === 'string');
}

function writeKeyList(key: string, keys: string[]): void {
  try {
    getIntegrityStore().set(key, JSON.stringify(keys));
  } catch {
    // Integrity bookkeeping must never be the reason a real save fails. The
    // user's write already landed in the main store by the time we get here;
    // losing this record only costs a later detection, and a throw here would
    // surface as "could not save your range", which would be a lie.
  }
}

/**
 * Record which keys the store currently holds. Call AFTER the write that changed
 * them, never before: a crash between the two then leaves the sidecar claiming
 * less than exists, which self-heals on the next write and reports nothing. The
 * other order would leave it claiming a key that never landed, and this code
 * would accuse the store of losing data it never had.
 */
export function noteStoredKeys(presentKeys: string[]): void {
  const inventory = JSON.stringify([...presentKeys].sort());
  if (inventory === writtenInventory) return;
  writtenInventory = inventory;
  writeKeyList(INVENTORY_KEY, [...presentKeys].sort());
}

/**
 * Compare what the store came back with against what was last recorded, and
 * remember any shortfall for the UI to surface. Called once, as the store is
 * opened, before anything has read through it.
 */
export function checkForLostKeys(presentKeys: string[]): void {
  const expected = readKeyList(INVENTORY_KEY);
  // Nothing recorded yet is a fresh install, not a loss.
  if (expected.length === 0) {
    noteStoredKeys(presentKeys);
    return;
  }
  const present = new Set(presentKeys);
  const lost = expected.filter((key) => !present.has(key));
  // Re-baseline either way, so one corruption is reported once instead of at
  // every launch until the missing keys happen to be written again.
  noteStoredKeys(presentKeys);
  if (lost.length === 0) return;
  const pending = [...new Set([...readKeyList(PENDING_LOSS_KEY), ...lost])].sort();
  writeKeyList(PENDING_LOSS_KEY, pending);
  // Storage keys are compile-time constants naming slices, never user content —
  // no range name, note or practice record can reach Sentry through this.
  unreported = [...unreported, ...lost];
  flushReports();
}

/**
 * Keys found missing and not yet acknowledged by the user. Survives relaunch on
 * purpose: the app being killed before the notice is read must not be the reason
 * someone never learns their data went.
 */
export function pendingStorageLoss(): string[] {
  return readKeyList(PENDING_LOSS_KEY);
}

/** Clear the notice once the user has seen it. */
export function acknowledgeStorageLoss(): void {
  try {
    getIntegrityStore().remove(PENDING_LOSS_KEY);
  } catch {
    // Same trade as writeKeyList: failing to clear the notice shows it again,
    // which is a far better outcome than throwing out of a dismiss handler.
  }
}
