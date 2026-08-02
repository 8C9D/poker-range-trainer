import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';

/**
 * Live-save failure handling for the editors that persist from an effect.
 *
 * The reused `@core/storage` writer throws a readable error when the device store
 * is full or unavailable. Thrown from an effect, React unmounts the whole screen
 * into the root ErrorBoundary — which takes the unsaved edit with it and re-throws
 * on the next keystroke. Catching it keeps the editor on screen with its work
 * intact and puts the reason where the user can act on it.
 */
export function useLiveSave(): [string | null, (save: () => void) => void] {
  const [saveError, setSaveError] = useState<string | null>(null);

  const runSave = useCallback((save: () => void) => {
    try {
      save();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this range.');
      return;
    }
    setSaveError(null);
  }, []);

  return [saveError, runSave];
}

interface SaveErrorBannerProps {
  /** The message from {@link useLiveSave}; nothing renders while it is null. */
  error: string | null;
  testID?: string;
}

/** Inline "the last edit did not land" line for a live-saving editor. */
export function SaveErrorBanner({ error, testID = 'save-error' }: SaveErrorBannerProps) {
  const theme = useTheme();
  if (!error) return null;
  return (
    <Text testID={testID} accessibilityRole="alert" style={[styles.error, { color: theme.bad }]}>
      {error}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
