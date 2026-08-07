import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackupPanel } from '../../components/BackupPanel';
import { ResetStatsPanel } from '../../components/ResetStatsPanel';
import { Screen } from '../../components/Screen';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

/**
 * Account tab: the whole-library file backup (export/import) and the
 * practice-record reset. Cloud sync was cut from v1 (archived/cloud-sync/);
 * the app is local-only and the file backup is how data moves between devices.
 */
export default function AccountScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>Account</Text>
        <BackupPanel />
        <View style={[styles.divider, { backgroundColor: theme.line }]} />
        <ResetStatsPanel />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  title: { fontFamily: fonts.display, fontSize: 30, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
