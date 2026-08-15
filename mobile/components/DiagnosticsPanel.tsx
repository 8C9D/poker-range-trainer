import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';
import { isCrashReportingEnabled, sendTestCrashReport } from '../platform/crashReporting';

/**
 * The Account tab's crash-reporting check, rendered only when the Sentry DSN
 * is set: a build without reporting shows nothing here at all. Exists for the
 * TestFlight pass (LAUNCH-CHECKLIST.md step 9.6) - the one way to know a crash
 * actually reaches the dashboard is to send one on purpose and go look.
 */
export function DiagnosticsPanel() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [status, setStatus] = useState('');

  const handleSend = useCallback(() => {
    sendTestCrashReport();
    setStatus('Test report sent - it should appear in the Sentry dashboard within a minute.');
  }, []);

  if (!isCrashReportingEnabled()) return null;

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Diagnostics</Text>
      <Text style={styles.body}>
        Crash reporting is on. Only anonymous crash and performance diagnostics are sent - never
        your ranges or practice data.
      </Text>
      <Pressable testID="send-test-crash-report" accessibilityRole="button" style={styles.button} onPress={handleSend}>
        <Text style={styles.buttonText}>Send test crash report</Text>
      </Pressable>
      {status ? (
        <Text testID="diagnostics-status" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    panel: { gap: 12 },
    sectionTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: theme.ink },
    body: { fontFamily: fonts.body, fontSize: 14, color: theme.ink2 },
    button: {
      backgroundColor: theme.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
    },
    buttonText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.ink },
    status: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.accentStrong },
  });
}
