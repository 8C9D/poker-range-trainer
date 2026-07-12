import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

// Account tab — placeholder shell for the Coach routing skeleton. Links out to the
// existing auth + backup flat routes so cloud sync and file backup stay reachable
// during the port; the consolidated Account screen lands in a later slice.
export default function AccountScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.ink }]}>Account</Text>
        <Text style={[styles.subtitle, { color: theme.ink2 }]}>
          Sign in, sync, and back up your ranges.
        </Text>
        <View style={styles.links}>
          <Link href="/auth" asChild>
            <Pressable style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <Text style={[styles.rowText, { color: theme.ink }]}>Account & cloud sync</Text>
            </Pressable>
          </Link>
          <Link href="/backup" asChild>
            <Pressable style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <Text style={[styles.rowText, { color: theme.ink }]}>Backup & data tools</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 24, gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 34, marginTop: 12 },
  subtitle: { fontFamily: fonts.body, fontSize: 16 },
  links: { gap: 12, marginTop: 8 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16 },
  rowText: { fontFamily: fonts.bodySemibold, fontSize: 16 },
});
