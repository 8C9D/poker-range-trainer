import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { resetPracticeRecords } from '@core/storage/statsReset';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/**
 * The Account tab's clear-the-record action: wipes practice stats, history,
 * review schedules and accuracy records while keeping the ranges themselves.
 */
export function ResetStatsPanel() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset practice stats',
      'Clear all practice stats, history, review schedules and spot accuracy? Your ranges and daily goal are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setError('');
            try {
              resetPracticeRecords();
            } catch (err) {
              setStatus('');
              setError(err instanceof Error ? err.message : 'Could not reset your practice stats.');
              return;
            }
            setStatus('Practice stats cleared — your ranges are untouched.');
          },
        },
      ],
    );
  }, []);

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Practice record</Text>
      {/* The only clean slate that keeps the charts: deleting ranges takes their
          records with them, and clearing app data takes everything. */}
      <Pressable testID="reset-practice-stats" accessibilityRole="button" style={styles.button} onPress={handleReset}>
        <Text style={styles.buttonText}>Reset practice stats</Text>
      </Pressable>
      {status ? (
        <Text testID="reset-status" style={styles.status}>
          {status}
        </Text>
      ) : null}
      {error ? (
        <Text testID="reset-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    panel: { gap: 12 },
    sectionTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: theme.ink },
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
    error: { fontFamily: fonts.body, fontSize: 14, color: theme.bad },
  });
}
