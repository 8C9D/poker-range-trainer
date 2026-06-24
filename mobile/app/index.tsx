import { StyleSheet, Text, View } from 'react-native';

import { ALL_HANDS } from '@core/domain/pokerHands';

import { colors } from '../theme/colors';

// Placeholder home screen. Renders the app title plus a value derived from the
// reused @core domain logic (proving cross-package reuse) — the real trainer UI
// (the range library) replaces this in a later M2 slice. The status bar is set
// once in the root layout.
export const APP_TITLE = 'Poker Range Trainer';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_TITLE}</Text>
      <Text style={styles.subtitle}>{ALL_HANDS.length} starting hands</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textStrong,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: colors.text,
  },
});
