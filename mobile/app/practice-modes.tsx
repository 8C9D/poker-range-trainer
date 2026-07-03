import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';

import { colors } from '../theme/colors';

/**
 * Practice-mode picker for one saved range: choose between recognition practice (see a
 * hand, answer in/out) and build-from-memory (rebuild the range on a blank grid). The
 * library card's "Practice" action opens this; each mode is its own screen. Keeping the
 * choice here keeps the cards uncluttered and leaves room for more modes later.
 */
export default function PracticeModesScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Practice' }} />
      <Link href={{ pathname: '/practice', params: { id: idParam } }} asChild>
        <Pressable testID="mode-recognition" accessibilityRole="button" style={styles.mode}>
          <Text style={styles.modeTitle}>Recognition</Text>
          <Text style={styles.modeDesc}>See a hand and answer in or out of range.</Text>
        </Pressable>
      </Link>
      <Link href={{ pathname: '/build', params: { id: idParam } }} asChild>
        <Pressable testID="mode-build" accessibilityRole="button" style={styles.mode}>
          <Text style={styles.modeTitle}>Build from memory</Text>
          <Text style={styles.modeDesc}>Rebuild the whole range on a blank grid, then check.</Text>
        </Pressable>
      </Link>
      <Link href={{ pathname: '/timed', params: { id: idParam } }} asChild>
        <Pressable testID="mode-timed" accessibilityRole="button" style={styles.mode}>
          <Text style={styles.modeTitle}>Timed drill</Text>
          <Text style={styles.modeDesc}>Answer as many as you can before the clock runs out.</Text>
        </Pressable>
      </Link>
      <Link href={{ pathname: '/action-quiz', params: { id: idParam } }} asChild>
        <Pressable testID="mode-action-quiz" accessibilityRole="button" style={styles.mode}>
          <Text style={styles.modeTitle}>Action quiz</Text>
          <Text style={styles.modeDesc}>Name the correct action for each hand.</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    gap: 12,
  },
  mode: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  modeTitle: {
    color: colors.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  modeDesc: {
    color: colors.text,
    fontSize: 14,
  },
});
