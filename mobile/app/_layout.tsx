// Install platform polyfills (side effects) before anything else, so @core has a
// synchronous localStorage backing and real-UUID identity before any screen loads.
import '../platform/installStorage';
import '../platform/installCrypto';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '../theme/colors';

// Root navigator for the Expo Router app. Screens live under app/. The dark theme
// (matching the web app) is applied here once via screenOptions.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.textStrong },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
