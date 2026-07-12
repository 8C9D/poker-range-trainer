import { ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { FrequenciesEditor } from '../components/FrequenciesEditor';
import { colors } from '../theme/colors';

/**
 * Flat mixed-frequency editor route. Thin wrapper around the shared `FrequenciesEditor`
 * body (also used by the Range page's Frequencies tab). Removed at M8.
 */
export default function FrequencyEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Edit frequencies' }} />
      <FrequenciesEditor id={idParam} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
});
