import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

// Progress tab — placeholder shell for the Coach routing skeleton. The full progress
// screen (streak/accuracy/all-time tiles, 7-day chart, weakest hands) lands in a later
// slice.
export default function ProgressScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.ink }]}>Progress</Text>
        <Text style={[styles.subtitle, { color: theme.ink2 }]}>
          Your training trends will live here.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 34 },
  subtitle: { fontFamily: fonts.body, fontSize: 16 },
});
