import { ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { ComboExplorer } from '../components/ComboExplorer';
import { colors } from '../theme/colors';

/**
 * Flat combo-explorer route. Thin wrapper around the shared `ComboExplorer` body (also
 * used by the Range page's Combos tab). Removed at M8.
 */
export default function CombosScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Combos' }} />
      <ComboExplorer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 16 },
});
