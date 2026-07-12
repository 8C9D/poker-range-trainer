// Flat ESLint config for the Expo app, using eslint-config-expo. This is kept
// fully separate from the web app's root ESLint config — the root config
// ignores mobile/, so RN code is never linted by the web toolchain.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // The Jest setup file (setupFilesAfterEnv) runs in the Jest environment but its
    // name isn't matched by the test-file glob, so grant it the `jest` global.
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
  {
    // coresrc is a symlink to ../src used only by Metro; the web source it points
    // to is linted by the root web toolchain, not here.
    ignores: ['dist/*', '.expo/*', 'coresrc/*'],
  },
];
