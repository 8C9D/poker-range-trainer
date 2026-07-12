// Global Jest setup (setupFilesAfterEnv). The Coach screens read the top inset from
// react-native-safe-area-context; at runtime the provider is supplied by expo-router's
// root, but screen tests render a screen in isolation, so we install the package's own
// jest mock (fixed insets, pass-through SafeAreaProvider/SafeAreaView) here once for all
// suites. RNTL v14 still auto-registers its matchers on import — this file only adds the
// safe-area mock.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
