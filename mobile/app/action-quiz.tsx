import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ActionQuizDrill } from '../components/practice/ActionQuizDrill';
import { colors } from '../theme/colors';

/** Flat action-quiz route. Thin wrapper around the shared `ActionQuizDrill`. Removed at M8. */
export default function ActionQuizScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Action quiz' }} />
      <ActionQuizDrill id={idParam} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
