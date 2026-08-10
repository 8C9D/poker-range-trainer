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

export function createMMKV(configuration?: MockConfiguration) {
  lastConfiguration = configuration;
  const store = new Map<string, string>();
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
