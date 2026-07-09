import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { buildBackup, parseBackup, restoreBackup, serializeBackup } from '@core/storage/backup';

import { colors } from '../theme/colors';

const BACKUP_FILE = 'poker-ranges-backup.json';

/**
 * File backup (M7): export the whole local library to a JSON file (and share it out), or import
 * one back — fully offline, no account needed. Snapshot / serialize / parse / restore all reuse
 * `@core/storage/backup`; this screen only handles the device file I/O (write + share, pick + read)
 * via expo-file-system / expo-sharing / expo-document-picker.
 */
export default function BackupScreen() {
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'File backup' }} />
      <Text style={styles.hint}>
        Save your whole library to a JSON file you can store or move to another device, or restore one
        you exported earlier. This works offline — no account needed.
      </Text>

      <Pressable
        testID="backup-export"
        accessibilityRole="button"
        disabled={busy}
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={handleExport}
      >
        <Text style={styles.buttonText}>Back up to a file</Text>
      </Pressable>

      <Pressable
        testID="backup-import"
        accessibilityRole="button"
        disabled={busy}
        style={[styles.button, styles.secondary, busy && styles.buttonDisabled]}
        onPress={handleImport}
      >
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  hint: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
});
