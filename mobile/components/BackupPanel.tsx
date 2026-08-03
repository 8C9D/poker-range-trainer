import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { buildBackup, parseBackup, restoreBackup, serializeBackup } from '@core/storage/backup';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

const BACKUP_FILE = 'poker-ranges-backup.json';

/**
 * File-backup panel: export the whole local library to a JSON file (and share it out), or import
 * one back — fully offline, no account needed. Snapshot / serialize / parse / restore reuse
 * `@core/storage/backup`; this only handles device file I/O via expo-file-system / sharing / picker.
 */
export function BackupPanel() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (op: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await op();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleExport = useCallback(() => {
    void run(async () => {
      const uri = (documentDirectory ?? '') + BACKUP_FILE;
      await writeAsStringAsync(uri, serializeBackup(buildBackup()));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
        setStatus('Exported your library.');
      } else {
        setStatus(`Saved backup to ${uri}`);
      }
    });
  }, [run]);

  const handleImport = useCallback(() => {
    void run(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;
      const backup = parseBackup(await readAsStringAsync(uri));
      restoreBackup(backup);
      const count = backup.ranges.length;
      setStatus(`Restored ${count} range${count === 1 ? '' : 's'} from the file.`);
    });
  }, [run]);

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>File backup</Text>
      <Text style={styles.hint}>
        Save your whole library to a JSON file you can store or move to another device, or restore
        one you exported earlier. This works offline — no account needed.
      </Text>
      <Pressable testID="backup-export" accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.buttonDisabled]} onPress={handleExport}>
        <Text style={styles.buttonText}>Back up to a file</Text>
      </Pressable>
      <Pressable testID="backup-import" accessibilityRole="button" disabled={busy} style={[styles.button, styles.secondary, busy && styles.buttonDisabled]} onPress={handleImport}>
        <Text style={styles.secondaryText}>Restore from a file</Text>
      </Pressable>
      {status ? (
        <Text testID="backup-status" style={styles.status}>
          {status}
        </Text>
      ) : null}
      {error ? (
        <Text testID="backup-error" style={styles.error}>
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
    button: { backgroundColor: theme.goldFill, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    secondary: { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line2 },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.onAccent },
    secondaryText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.ink },
    status: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.accentStrong },
    error: { fontFamily: fonts.body, fontSize: 14, color: theme.bad },
  });
}
