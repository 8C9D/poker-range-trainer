import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { BuildDrill } from '../components/practice/BuildDrill';
import { colors } from '../theme/colors';

/** Flat build-from-memory route. Thin wrapper around the shared `BuildDrill`. Removed at M8. */
export default function BuildScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Build from memory' }} />
      <BuildDrill id={idParam} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
