import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { normalizeTags } from '@core/domain/rangeLibrary';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

export interface RangeTagEditorProps {
  /** Current tags (controlled; the parent owns the list). */
  tags: string[];
  /** Fired with the next tag list whenever a tag is added or removed. */
  onChange: (next: string[]) => void;
}

/**
 * Controlled editor for a range's organization tags: a text input adds a tag
 * (submit or the Add button) and each current tag renders as a chip with a
 * remove control. Adding runs the new list through {@link normalizeTags} so
 * blanks and case-insensitive duplicates never enter; the tag list is
 * parent-owned. The RN port of the web `RangeTagEditor`.
 */
export function RangeTagEditor({ tags, onChange }: RangeTagEditorProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [draft, setDraft] = useState('');

  function addTag() {
    const next = normalizeTags([...tags, draft]);
    setDraft('');
    // Only report a change when the draft actually added a new tag.
    if (next.length !== tags.length) onChange(next);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Tags</Text>
      {tags.length > 0 ? (
        <View style={styles.chips}>
          {tags.map((tag) => (
            <View key={tag} style={styles.chip}>
              <Text style={styles.chipText}>{tag}</Text>
              <Pressable
                testID={`remove-tag-${tag}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${tag}`}
                hitSlop={8}
                onPress={() => onChange(tags.filter((existing) => existing !== tag))}
              >
                <Text style={styles.chipRemove}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.addRow}>
        <TextInput
          testID="tag-input"
          style={styles.input}
          placeholder="Add a tag"
          placeholderTextColor={theme.ink3}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addTag}
          returnKeyType="done"
          autoCapitalize="none"
        />
        <Pressable
          testID="add-tag"
          accessibilityRole="button"
          accessibilityState={{ disabled: draft.trim() === '' }}
          disabled={draft.trim() === ''}
          style={[styles.addButton, draft.trim() === '' && styles.addButtonDisabled]}
          onPress={addTag}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 10,
    },
    heading: {
      color: theme.ink,
      fontSize: 16,
      fontWeight: '600',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: {
      color: theme.ink2,
      fontSize: 13,
      fontWeight: '600',
    },
    chipRemove: {
      color: theme.ink3,
      fontSize: 15,
      fontWeight: '700',
    },
    addRow: {
      flexDirection: 'row',
      gap: 8,
    },
    input: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.ink,
      backgroundColor: theme.card,
    },
    addButton: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 8,
      paddingHorizontal: 14,
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    addButtonDisabled: {
      opacity: 0.5,
    },
    addButtonText: {
      color: theme.ink,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
