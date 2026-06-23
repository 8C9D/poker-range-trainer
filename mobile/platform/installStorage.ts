import { installLocalStorage } from './localStorageShim';

// Side-effect import: installs the MMKV-backed `localStorage` shim onto
// `globalThis` the moment this module is imported. It is imported on the very
// first line of the router entry (app/_layout.tsx) so the shim exists before any
// `@core/storage` module loads and reads/writes `localStorage`.
installLocalStorage();
