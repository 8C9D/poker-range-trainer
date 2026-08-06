import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthPanel } from '../../components/AuthPanel';
import { ResetStatsPanel } from '../../components/ResetStatsPanel';
import { Screen } from '../../components/Screen';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

/**
 * Account tab: sign-in + cloud sync (push/pull with confirm-before-overwrite, delete cloud data)
 * and the practice-record reset, plus the local-only note when Supabase env is unset. All logic
 * lives in the reused `@core/cloud` + `@core/storage` behind the AuthPanel / ResetStatsPanel
 * components.
 */
export default function AccountScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>Account</Text>
        <AuthPanel />
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
