// Install platform polyfills (side effects) before anything else, so @core has a
// synchronous localStorage backing and real-UUID identity before any screen loads.
// react-native-url-polyfill provides the WHATWG URL that @supabase/supabase-js needs on Hermes.
import 'react-native-url-polyfill/auto';
import '../platform/installStorage';
import '../platform/installCrypto';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { colors } from '../theme/colors';

// Root navigator for the Expo Router app. Screens live under app/. The root is
// wrapped in GestureHandlerRootView (required for the grid's drag-paint gestures)
// and an ErrorBoundary (so a render error shows a recoverable fallback instead of
// a blank screen), and the dark theme (matching the web app) is applied once via
// screenOptions.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.brand },
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.textStrong },
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
