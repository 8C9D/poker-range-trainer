import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ComboDrill } from '../components/practice/ComboDrill';
import { colors } from '../theme/colors';

/** Flat blocker-aware combo drill route. Thin wrapper around the shared `ComboDrill`. Removed at M8. */
export default function BlockerDrillScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Blocker drill' }} />
      <ComboDrill id={idParam} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
