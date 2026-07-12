import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { assignedHands } from '@core/domain/actionRange';
import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';
import type { RangeAction } from '@core/types/range';

import { ActionGrid } from './ActionGrid';
import { ActionNotation } from './ActionNotation';
import { ActionPalette } from './ActionPalette';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/**
 * Multi-action editor body for one saved range: pick the active action in the palette,
 * then tap grid cells to assign it (the `handActions` overlay). Assignments live-save
 * onto the range through the reused `@core/storage`, preserving the range's other fields.
 * Shared by the flat action-editor route and the Range page's Actions tab.
 */
export function ActionsEditor({ id }: { id?: string }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const [handActions, setHandActions] = useState<Record<PokerHand, RangeAction>>(
    () => range?.handActions ?? ({} as Record<PokerHand, RangeAction>),
  );
  const [activeAction, setActiveAction] = useState<RangeAction>('raise');

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!range) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    saveSavedRange({ ...range, handActions, updatedAt: new Date().toISOString() });
  }, [handActions, range]);

  const assign = useCallback((hand: PokerHand, action: RangeAction | null) => {
    setHandActions((prev) => {
      const next = { ...prev };
      if (action === null) delete next[hand];
      else next[hand] = action;
      return next;
    });
  }, []);

  if (!range) {
    return <Text style={styles.notFound}>Range not found</Text>;
  }

  return (
    <View style={styles.content}>
      <ActionPalette active={activeAction} onSelect={setActiveAction} />
      <ActionGrid handActions={handActions} activeAction={activeAction} onAssign={assign} />
      <Text testID="assigned-count" style={styles.count}>
        {assignedHands(handActions).length} hands assigned
      </Text>
      <ActionNotation handActions={handActions} onReplaceActions={setHandActions} />
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: { gap: 16 },
    notFound: { color: theme.ink2, fontSize: 16, marginTop: 32, textAlign: 'center' },
    count: { color: theme.ink2, fontSize: 14 },
  });
}
