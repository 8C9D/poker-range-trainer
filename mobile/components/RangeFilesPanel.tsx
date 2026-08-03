import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  parseRangeCsv,
  parseRangeExport,
  parseRangePack,
  serializeRangePack,
} from '@core/domain/rangeTransfer';
import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import { createRangeId } from '../platform/createRangeId';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

const PACK_FILE = 'poker-range-pack.json';

/** Add an imported range under a fresh id so an import never clobbers an existing range. */
function addAsNewRange(range: SavedRange): void {
  const now = new Date().toISOString();
  saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now });
}

/**
 * Range-file interchange: export the library as a range **pack** file to hand to another
 * device or person, import a pack back, or import a single exported range. The parallel of
 * the web app's Data section, minus the whole-library backup (that is `BackupPanel`): a pack
 * carries only ranges, so importing one adds to the library instead of replacing it.
 * Envelope building/parsing is `@core/domain/rangeTransfer`; this only does device file I/O.
 */
export function RangeFilesPanel() {
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

  const pickFile = useCallback(
    async (type: string): Promise<{ text: string; name: string } | null> => {
      const result = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: true });
      if (result.canceled) return null;
      const asset = result.assets[0];
      if (!asset?.uri) return null;
      return { text: await readAsStringAsync(asset.uri), name: asset.name ?? '' };
    },
    [],
  );

  const handleExportPack = useCallback(() => {
    void run(async () => {
      const ranges = loadSavedRanges();
      if (ranges.length === 0) {
        setStatus('No ranges to export yet.');
        return;
      }
      const uri = (documentDirectory ?? '') + PACK_FILE;
      await writeAsStringAsync(uri, serializeRangePack('', ranges));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
        setStatus(`Exported ${ranges.length} range${ranges.length === 1 ? '' : 's'}.`);
      } else {
        setStatus(`Saved pack to ${uri}`);
      }
    });
  }, [run]);

  const handleImportPack = useCallback(() => {
    void run(async () => {
      const picked = await pickFile('application/json');
      if (!picked) return;
      const pack = parseRangePack(picked.text);
      pack.ranges.forEach(addAsNewRange);
      const count = pack.ranges.length;
      setStatus(`Added ${count} range${count === 1 ? '' : 's'} from the pack.`);
    });
  }, [pickFile, run]);

  const handleImportRange = useCallback(() => {
    void run(async () => {
      const picked = await pickFile('application/json');
      if (!picked) return;
      const range = parseRangeExport(picked.text);
      addAsNewRange(range);
      setStatus(`Added “${range.name || 'Untitled'}” to your library.`);
    });
  }, [pickFile, run]);

  const handleImportCsv = useCallback(() => {
    void run(async () => {
      const picked = await pickFile('text/comma-separated-values');
      if (!picked) return;
      const parsed = parseRangeCsv(picked.text);
      // The CSV may omit a name; fall back to the file name (sans extension).
      const fallback = picked.name.replace(/\.csv$/i, '').trim() || 'Imported range';
      const name = parsed.name?.trim() || fallback;
      const now = new Date().toISOString();
      saveSavedRange({
        id: createRangeId(),
        name,
        hands: parsed.hands,
        createdAt: now,
        updatedAt: now,
      });
      setStatus(`Added “${name}” from CSV.`);
    });
  }, [pickFile, run]);

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Range files</Text>
      <Text style={styles.hint}>
        A pack is just your ranges — importing one adds to your library instead of replacing
        it, so it is the safe way to share ranges with another device or person.
      </Text>
      <Pressable
        testID="pack-export"
        accessibilityRole="button"
        disabled={busy}
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={handleExportPack}
      >
        <Text style={styles.buttonText}>Export a pack file</Text>
      </Pressable>
      <Pressable
        testID="pack-import"
        accessibilityRole="button"
        disabled={busy}
        style={[styles.button, styles.secondary, busy && styles.buttonDisabled]}
        onPress={handleImportPack}
      >
        <Text style={styles.secondaryText}>Import a pack file</Text>
      </Pressable>
      <Pressable
        testID="range-import"
        accessibilityRole="button"
        disabled={busy}
        style={[styles.button, styles.secondary, busy && styles.buttonDisabled]}
        onPress={handleImportRange}
      >
        <Text style={styles.secondaryText}>Import a single range file</Text>
      </Pressable>
      <Pressable
        testID="csv-import"
        accessibilityRole="button"
        disabled={busy}
        style={[styles.button, styles.secondary, busy && styles.buttonDisabled]}
        onPress={handleImportCsv}
      >
        <Text style={styles.secondaryText}>Import a CSV file</Text>
      </Pressable>
      {status ? (
        <Text testID="range-files-status" style={styles.status}>
          {status}
        </Text>
      ) : null}
      {error ? (
        <Text testID="range-files-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    panel: { gap: 10 },
    sectionTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: theme.ink },
    hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: theme.ink2 },
    button: {
      backgroundColor: theme.goldFill,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.onAccent },
    secondaryText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.ink },
    status: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.accent },
    error: { fontFamily: fonts.body, fontSize: 14, color: theme.bad },
  });
}
