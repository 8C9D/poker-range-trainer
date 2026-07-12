import { ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { RangeEditor } from '../components/RangeEditor';
import { colors } from '../theme/colors';

/**
 * Flat create/edit route. Thin wrapper around the shared `RangeEditor` body (also used
 * by the Range page's Edit tab). With an `id` param it edits that range; otherwise it
 * starts a fresh draft. Removed at M8 once the Range page fully replaces it.
 */
export default function EditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  return (
    <ScrollView style={styles.screen}>
      <Stack.Screen options={{ title: idParam ? 'Edit range' : 'New range' }} />
      <RangeEditor id={idParam} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
