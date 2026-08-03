// Install platform polyfills (side effects) before anything else, so @core has a
// synchronous localStorage backing and real-UUID identity before any screen loads.
// react-native-url-polyfill provides the WHATWG URL that @supabase/supabase-js needs on Hermes.
import 'react-native-url-polyfill/auto';
import '../platform/installStorage';
import '../platform/installCrypto';
import { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { useTheme } from '../theme/colors';

// Hold the native splash until the Coach fonts are ready, so the first painted frame
// already uses Bricolage Grotesque / Instrument Sans (no flash of system font). Keys
// match the family names in theme/fonts.ts.
void SplashScreen.preventAutoHideAsync();

// Root navigator for the Expo Router app. Screens live under app/. The root is
// wrapped in GestureHandlerRootView (required for the grid's drag-paint gestures)
// and an ErrorBoundary (so a render error shows a recoverable fallback instead of
// a blank screen).
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  // Reveal the app once fonts are ready; a font error still reveals it (system font
  // fallback beats a stuck splash screen).
  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const theme = useTheme();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.accentStrong,
            headerTitleStyle: { color: theme.ink },
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          {/* The tab group owns its own chrome (bottom bar + in-content headers). */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
