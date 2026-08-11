// Jest config for the Expo app. The jest-expo preset wires up the React Native
// transform/environment. @testing-library/react-native v14 auto-registers its
// Jest matchers on import, so no extra setup file is needed. The web app uses
// Vitest separately (root vitest.config.ts).
//
// jest-expo does not read tsconfig `paths`, so the @core/* alias (shared core in
// ../src) is mapped explicitly here to match tsconfig.json. coresrc is the
// Metro-only symlink to ../src; ignore it here so the web source it points to
// isn't picked up by the mobile Jest.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/../src/$1',
  },
  // archived/ (repo root) holds features cut from v1 whose code is expected
  // not to compile; keep Jest away from it alongside the Metro-only symlink.
  modulePathIgnorePatterns: ['<rootDir>/coresrc/', '<rootDir>/../archived/'],
  // Installs the react-native-safe-area-context mock so Coach screens (which read the
  // top inset) render in isolation. jest-expo sets setupFiles, not setupFilesAfterEnv.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Uninstall every `jest.spyOn` between tests, matching the root vitest.config.ts.
  // Without it a test that restores its spy inline restores it only when nothing
  // failed: a failing assertion skips the restore and the spy leaks into every
  // test after it in the file, so one red test becomes a cascade and the guard
  // stops being readable as evidence of what it covers. Restoring runs BEFORE
  // each test's `beforeEach`, so a spy a hook installs still reaches the body
  // (probed, not assumed). `jest.mock` factories are untouched by this.
  restoreMocks: true,
};
