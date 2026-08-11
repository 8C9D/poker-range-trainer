// Manual Jest mock for react-native-mmkv v4 (Nitro). The real package is a
// JSI/native module jest-expo cannot load in Node, so tests run against this
// in-memory implementation of the MMKV surface the localStorage shim uses
// (set / getString / remove / clearAll / getAllKeys / length). Behavior mirrors
// MMKV: `getString` returns `undefined` for a missing key. Like the real v4 API,
// instances are produced by `createMMKV()`.

/** The `Configuration` fields the shim actually passes. */
interface MockConfiguration {
  id?: string;
  recoveryStrategy?: string;
}

let lastConfiguration: MockConfiguration | undefined;
const configurationsById = new Map<string, MockConfiguration>();

/**
 * The configuration of the most recent `createMMKV()` call.
 *
 * The mock ignores the configuration when storing values — an in-memory Map has
 * no CRC to fail — so without this, options that only matter natively (notably
 * `recoveryStrategy`, which decides whether corruption discards every key or is
 * recovered) could be dropped from the shim and no test would notice.
 */
export function __lastConfiguration(): MockConfiguration | undefined {
  return lastConfiguration;
}

/**
 * The configuration a given instance id was opened with.
 *
 * The app now opens two instances — the main store and the integrity sidecar,
 * which is a separate file precisely so one corruption cannot take both — and
 * "most recent" then depends on which happened to be touched last. Asking by id
 * makes the `recoveryStrategy` assertion independent of that order.
 */
export function __configurationFor(id: string): MockConfiguration | undefined {
  return configurationsById.get(id);
}

/**
 * One backing Map per instance id, because that is what MMKV does: the id names
 * a file, and two `createMMKV` calls with the same id read the same bytes. A
 * fresh Map per call would have made the integrity sidecar look like it forgot
 * everything on relaunch, which is the exact thing it exists to remember.
 */
const storesById = new Map<string, Map<string, string>>();

/** Drop every backing store, for suites that need a clean device. */
export function __resetStores(): void {
  storesById.clear();
  configurationsById.clear();
  lastConfiguration = undefined;
}

export function createMMKV(configuration?: MockConfiguration) {
  lastConfiguration = configuration;
  const id = configuration?.id ?? 'mmkv.default';
  if (configuration?.id !== undefined) {
    configurationsById.set(configuration.id, configuration);
  }
  let store = storesById.get(id);
  if (store === undefined) {
    store = new Map<string, string>();
    storesById.set(id, store);
  }
  return {
    set(key: string, value: string): void {
      store.set(key, value);
    },
    getString(key: string): string | undefined {
      return store.get(key);
    },
    remove(key: string): boolean {
      return store.delete(key);
    },
    clearAll(): void {
      store.clear();
    },
    getAllKeys(): string[] {
      return Array.from(store.keys());
    },
    get length(): number {
      return store.size;
    },
  };
}
