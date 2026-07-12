import { ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ActionsEditor } from '../components/ActionsEditor';
import { colors } from '../theme/colors';

/**
 * Flat multi-action editor route. Thin wrapper around the shared `ActionsEditor` body
 * (also used by the Range page's Actions tab). Removed at M8.
 */
export default function ActionEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Edit actions' }} />
      <ActionsEditor id={idParam} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
});
