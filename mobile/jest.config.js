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
  modulePathIgnorePatterns: ['<rootDir>/coresrc/'],
  // Installs the react-native-safe-area-context mock so Coach screens (which read the
  // top inset) render in isolation. jest-expo sets setupFiles, not setupFilesAfterEnv.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
