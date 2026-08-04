import { useCallback, useRef, useState } from 'react';
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
export function useLiveSave(): [string | null, (save: () => void) => boolean] {
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveErrorRef = useRef<string | null>(null);

  const updateSaveError = useCallback((nextError: string | null) => {
    if (saveErrorRef.current === nextError) return;
    saveErrorRef.current = nextError;
    setSaveError(nextError);
  }, []);

  // Returns whether the write landed, so a caller that navigates or refreshes on
  // the back of a save only does so when there is something saved to show.
  const runSave = useCallback((save: () => void) => {
    try {
      save();
    } catch (error) {
      updateSaveError(error instanceof Error ? error.message : 'Could not save this range.');
      return false;
    }
    updateSaveError(null);
    return true;
  }, [updateSaveError]);

  return [saveError, runSave];
}

interface SaveErrorBannerProps {
  /** The message from {@link useLiveSave} or a caught save; null renders nothing. */
  error: string | null;
  testID?: string;
}

/** Inline "that save did not land" line, in the shared error treatment. */
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
