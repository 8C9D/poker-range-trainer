import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// jsdom + Testing Library for component tests; the React plugin handles JSX/TSX
// transforms (this config does not inherit vite.config.ts plugins).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The mobile/ Expo app carries its own Jest toolchain; keep its tests out of
    // the web Vitest run so they are never picked up here. archived/ holds
    // features cut from v1 whose code is expected not to compile.
    exclude: [...configDefaults.exclude, 'mobile/**', 'archived/**'],
    // Uninstall every `vi.spyOn` between tests, so a spy is never one test's
    // problem to hand to the next. Without this a test that restores its spy
    // inline restores it only on the path where nothing failed: a failing
    // assertion skips the restore, and the spy leaks into every test after it in
    // the file. That turns one red test into a cascade and makes the guard
    // unreadable as evidence of what it covers, which is the whole reason the
    // guards in PROD-READINESS.md were accepted. Restoring runs BEFORE each
    // test's `beforeEach` (`@vitest/runner` calls `onBeforeTryTask`, which does
    // the restoring, and then the `beforeEach` hooks), so a spy THAT hook
    // installs still reaches the body. A spy installed in `beforeAll` does not
    // survive: the restore runs before every test including the first, and
    // clears its registrations as it goes. Only `vi.spyOn` registers one, so
    // `vi.fn()` and `vi.mock` factories are untouched by this.
    restoreMocks: true,
    // The 13x13-grid screens render hundreds of cells per userEvent step, which can
    // exceed the 5s default when the full suite runs workers in parallel (they pass
    // in isolation). Give every test more headroom rather than sprinkling per-test
    // timeouts.
    testTimeout: 20000,
  },
})
