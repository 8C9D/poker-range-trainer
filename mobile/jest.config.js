// Jest config for the Expo app. The jest-expo preset wires up the React Native
// transform/environment. @testing-library/react-native v14 auto-registers its
// Jest matchers on import, so no extra setup file is needed. The web app uses
// Vitest separately (root vitest.config.ts).
module.exports = {
  preset: 'jest-expo',
};
