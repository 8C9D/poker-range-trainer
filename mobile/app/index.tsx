import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { ALL_HANDS } from '@core/domain/pokerHands';

// Placeholder home screen. Renders the app title plus a value derived from the
// reused @core domain logic (proving cross-package reuse) — the real trainer UI
// arrives in later milestones.
export const APP_TITLE = 'Poker Range Trainer';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_TITLE}</Text>
      <Text style={styles.subtitle}>{ALL_HANDS.length} starting hands</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#555',
  },
});
