// Install platform polyfills (side effects) before anything else, so @core has a
// synchronous localStorage backing and real-UUID identity before any screen loads.
import '../platform/installStorage';
import '../platform/installCrypto';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '../theme/colors';

// Root navigator for the Expo Router app. Screens live under app/. The root is
// wrapped in GestureHandlerRootView (required for the grid's drag-paint gestures),
// and the dark theme (matching the web app) is applied once via screenOptions.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.textStrong },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
