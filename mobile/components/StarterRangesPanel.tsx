import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { buildStarterRanges, starterRangesMissingFrom } from '@core/domain/starterRanges';
import { loadSavedRanges, saveSavedRanges } from '@core/storage/rangeStorage';
import { resetPracticeRecords } from '@core/storage/statsReset';

import { createRangeId } from '../platform/createRangeId';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/**
 * The Account tab's two library-wide actions: adding the built-in starter charts,
 * and clearing the practice record.
 *
 * The Library's empty state offers the starter charts too, but that offer
 * disappears the moment the user saves anything of their own, which is exactly
 * when a beginner realises they want a baseline. Only the charts the library does
 * not already hold are added, so running it twice is a no-op rather than a
 * duplicate pack.
 */
export function StarterRangesPanel() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleAdd = useCallback(() => {
    setError('');
    const missing = starterRangesMissingFrom(loadSavedRanges());
    if (missing.length === 0) {
      setStatus('Every starter chart is already in your library.');
      return;
    }
    try {
      saveSavedRanges(buildStarterRanges(new Date().toISOString(), createRangeId, missing));
    } catch (err) {
      setStatus('');
      setError(err instanceof Error ? err.message : 'Could not add the starter ranges.');
      return;
    }
    setStatus(`Added ${missing.length} starter chart${missing.length === 1 ? '' : 's'}.`);
  }, []);

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
      <Text accessibilityRole="header" style={styles.sectionTitle}>Starter ranges</Text>
      <Text style={styles.hint}>
        Standard 6-max 100bb charts: an open for every seat, big-blind defences, and 3-bets. They
        are ordinary ranges, so edit or delete any of them.
      </Text>
      <Pressable testID="add-starter-ranges" accessibilityRole="button" style={styles.button} onPress={handleAdd}>
        <Text style={styles.buttonText}>Add starter ranges</Text>
      </Pressable>
      {/* The only clean slate that keeps the charts: deleting ranges takes their
          records with them, and clearing app data takes everything. */}
      <Pressable testID="reset-practice-stats" accessibilityRole="button" style={styles.button} onPress={handleReset}>
        <Text style={styles.buttonText}>Reset practice stats</Text>
      </Pressable>
      {status ? (
        <Text testID="starter-status" style={styles.status}>
          {status}
        </Text>
      ) : null}
      {error ? (
        <Text testID="starter-error" style={styles.error}>
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
    hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: theme.ink2 },
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
