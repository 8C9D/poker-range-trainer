// Flat ESLint config for the Expo app, using eslint-config-expo. This is kept
// fully separate from the web app's root ESLint config — the root config
// ignores mobile/, so RN code is never linted by the web toolchain.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
];
