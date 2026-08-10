import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Synchronous `localStorage` polyfill backed by react-native-mmkv.
 *
 * The shared web core (`@core/storage/*`) persists everything through the
 * browser `localStorage` global — synchronous string get/set/remove under
 * stable keys. React Native has no `localStorage`, and `AsyncStorage` is async,
 * so it cannot back the core's synchronous reads. MMKV is JSI-backed and
 * synchronous, matching `localStorage` semantics exactly. Installing this onto
 * `globalThis` before any storage module loads lets every `@core/storage`
 * module run on device unchanged, storing the same keys/JSON shape as the web
 * app (so on-disk data stays forward-compatible with backup/cloud transfer).
 */

/** The `localStorage` surface the shared core relies on, plus trivial extras. */
interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

// One MMKV instance for all keys, created lazily so merely importing this module
// never touches the native module. That matters under Jest (where MMKV is
// mocked) and means screens importing the installer don't pay native init until
// the first actual read/write. react-native-mmkv v4 builds instances via
// createMMKV(); the named id is this app's on-disk store identifier.
//
// `recoveryStrategy` is set deliberately, and leaving it unset is not a neutral
// default. Unset, the option arrives at MMKV core as `std::nullopt`, which falls
// through to the legacy handler callback; with no handler registered — and
// react-native-mmkv registers none — that callback returns `OnErrorDiscard`.
// A single CRC or file-length error would then throw away every key in this
// instance, which is ALL NINE storage slices: the whole range library and the
// entire practice record, silently, with the app reading back as a fresh
// install. There is no account and no server to restore any of it from, only a
// backup file the user had to have chosen to export. 'recover-on-error' asks
// MMKV to salvage what it can instead.
let store: MMKV | null = null;
function getStore(): MMKV {
  if (store === null) {
    store = createMMKV({ id: 'poker-range-trainer', recoveryStrategy: 'recover-on-error' });
  }
  return store;
}

/** Synchronous, MMKV-backed implementation of the `localStorage` surface. */
export const localStorageShim: WebStorageLike = {
  getItem(key: string): string | null {
    // MMKV returns `undefined` for a missing key; `localStorage` returns `null`.
    // An empty string is a real stored value and is preserved (not nulled).
    return getStore().getString(key) ?? null;
  },
  setItem(key: string, value: string): void {
    getStore().set(key, value);
  },
  removeItem(key: string): void {
    getStore().remove(key);
  },
  clear(): void {
    getStore().clearAll();
  },
  key(index: number): string | null {
    return getStore().getAllKeys()[index] ?? null;
  },
  get length(): number {
    return getStore().length;
  },
};

/**
 * Install {@link localStorageShim} as `globalThis.localStorage`, but only when no
 * `localStorage` already exists. Idempotent and safe to call more than once.
 */
export function installLocalStorage(): void {
  const globalScope = globalThis as { localStorage?: unknown };
  if (globalScope.localStorage === undefined) {
    globalScope.localStorage = localStorageShim;
  }
}
