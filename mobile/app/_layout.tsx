// Install platform polyfills (side effects) before anything else, so @core has a
// synchronous localStorage backing and real-UUID identity before any screen loads.
import '../platform/installStorage';
import '../platform/installCrypto';
import { Stack } from 'expo-router';

// Root navigator for the Expo Router app. Screens live under app/.
export default function RootLayout() {
  return <Stack />;
}
