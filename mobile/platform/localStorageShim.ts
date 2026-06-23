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
let store: MMKV | null = null;
function getStore(): MMKV {
  if (store === null) {
    store = createMMKV({ id: 'poker-range-trainer' });
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
