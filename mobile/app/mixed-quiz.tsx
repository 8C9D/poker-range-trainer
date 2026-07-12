import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { MixedQuizDrill } from '../components/practice/MixedQuizDrill';
import { colors } from '../theme/colors';

/** Flat frequency-quiz route. Thin wrapper around the shared `MixedQuizDrill`. Removed at M8. */
export default function MixedQuizScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Frequency quiz' }} />
      <MixedQuizDrill id={idParam} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
