import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ALL_HANDS } from '@core/domain/pokerHands';

import { colors } from '../theme/colors';

// Home / landing screen. Shows the app title plus a value derived from the reused
// @core domain logic (proving cross-package reuse) and a link into the range
// editor. The range library replaces this landing in a later M2 slice.
export const APP_TITLE = 'Poker Range Trainer';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_TITLE}</Text>
      <Text style={styles.subtitle}>{ALL_HANDS.length} starting hands</Text>
      <Link href="/editor" asChild>
        <Pressable testID="new-range-button" style={styles.button}>
          <Text style={styles.buttonText}>New range</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textStrong,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
});
