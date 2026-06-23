// Installs the MMKV-backed localStorage shim (side effect) before anything else,
// so @core/storage has a synchronous localStorage backing before any screen loads.
import '../platform/installStorage';
import { Stack } from 'expo-router';

// Root navigator for the Expo Router app. Screens live under app/.
export default function RootLayout() {
  return <Stack />;
}
