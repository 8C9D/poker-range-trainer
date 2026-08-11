import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  assertBackupFileSize,
  buildBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from '@core/storage/backup';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

const BACKUP_FILE = 'poker-ranges-backup.json';

/**
 * Ask before a restore, resolving to what the user chose.
 *
 * A restore REPLACES the whole library, so a backup that is merely stale — not
 * malformed, so nothing in `validateBackup` objects to it — silently takes every
 * session recorded since it was written. There is no account and no server to
 * get any of that back from. The web path gates the same operation
 * (`src/screens/AccountScreen.tsx`); React Native has no `window.confirm`, and
 * this is its equivalent, kept promise-shaped so the destructive work stays
 * inside the caller's error handling.
 */
function confirmRestore(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Restore from a file',
      'Importing a backup REPLACES all your current local data. Continue?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Restore', style: 'destructive', onPress: () => resolve(true) },
      ],
    );
  });
}

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
      // Bound the read before it happens: `readAsStringAsync` pulls the whole
      // file into one JS string, and the picker filtered by declared type only.
      const info = await getInfoAsync(uri);
      if (info.exists) assertBackupFileSize(info.size);
      if (!(await confirmRestore())) return;
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
