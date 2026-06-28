import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack, useFocusEffect } from 'expo-router';

import {
  filterRangesByActionType,
  filterRangesByGameType,
  filterRangesByName,
  filterRangesByPosition,
  sortRangesByAccuracy,
  sortRangesByLastPracticed,
  sortRangesByName,
  sortRangesByUpdatedAt,
} from '@core/domain/rangeLibrary';
import { duplicateRange } from '@core/domain/rangeDuplication';
import { calculateRangePercentage } from '@core/domain/rangeMath';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { deleteSavedRange, loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import {
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  GAME_TYPES,
  GAME_TYPE_LABELS,
  POSITIONS,
  POSITION_LABELS,
  type ActionType,
  type GameType,
  type Position,
  type SavedRange,
} from '@core/types/range';

import { ChipRow } from '../components/ChipRow';
import { createRangeId } from '../platform/createRangeId';
import { colors } from '../theme/colors';

type SortKey = 'name' | 'updated' | 'practiced' | 'accuracy';

const SORTS: readonly { key: SortKey; label: string }[] = [
  { key: 'updated', label: 'Recent' },
  { key: 'name', label: 'Name' },
  { key: 'practiced', label: 'Practiced' },
  { key: 'accuracy', label: 'Accuracy' },
];

/**
 * Range library — the app's home screen. Lists saved ranges (reused
 * `@core/storage`), opens each in the editor, and deletes after confirmation. The
 * list reloads on focus so edits made in the editor are reflected on return.
 */
export default function LibraryScreen() {
  const [ranges, setRanges] = useState<SavedRange[]>(() => loadSavedRanges());
  const [practiceStats, setPracticeStats] = useState(() => loadPracticeStats());
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<Position | undefined>(undefined);
  const [actionType, setActionType] = useState<ActionType | undefined>(undefined);
  const [gameType, setGameType] = useState<GameType | undefined>(undefined);
  const [sort, setSort] = useState<SortKey>('updated');

  const reload = useCallback(() => {
    setRanges(loadSavedRanges());
    setPracticeStats(loadPracticeStats());
  }, []);

  // Reload whenever the screen regains focus (e.g. returning from the editor).
  useFocusEffect(reload);

  // Search + metadata filters narrow the list; `ranges` stays the full loaded set.
  const filtered = useMemo(
    () =>
      filterRangesByGameType(
        filterRangesByActionType(
          filterRangesByPosition(filterRangesByName(ranges, query), position ?? null),
          actionType ?? null,
        ),
        gameType ?? null,
      ),
    [ranges, query, position, actionType, gameType],
  );

  // Then sort the filtered list with the chosen @core comparator.
  const visible = useMemo(() => {
    switch (sort) {
      case 'name':
        return sortRangesByName(filtered);
      case 'practiced':
        return sortRangesByLastPracticed(filtered, practiceStats);
      case 'accuracy':
        return sortRangesByAccuracy(filtered, practiceStats);
      case 'updated':
      default:
        return sortRangesByUpdatedAt(filtered);
    }
  }, [filtered, sort, practiceStats]);

  const handleDuplicate = useCallback(
    (range: SavedRange) => {
      saveSavedRange(duplicateRange(range, createRangeId(), new Date().toISOString()));
      reload();
    },
    [reload],
  );

  const confirmDelete = useCallback(
    (range: SavedRange) => {
      Alert.alert('Delete range', `Delete "${range.name || 'Untitled'}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSavedRange(range.id);
            reload();
          },
        },
      ]);
    },
    [reload],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Ranges',
          headerRight: () => (
            <Link href="/editor" style={styles.headerLink}>
              New
            </Link>
          ),
        }}
      />
      {ranges.length > 0 ? (
        <>
          <TextInput
            testID="library-search"
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search ranges"
            placeholderTextColor={colors.text}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <View style={styles.filters}>
            <ChipRow
              label="Position"
              testIdPrefix="filter-position"
              options={POSITIONS}
              labels={POSITION_LABELS}
              selected={position}
              onSelect={setPosition}
            />
            <ChipRow
              label="Action"
              testIdPrefix="filter-action"
              options={ACTION_TYPES}
              labels={ACTION_TYPE_LABELS}
              selected={actionType}
              onSelect={setActionType}
            />
            <ChipRow
              label="Game"
              testIdPrefix="filter-game"
              options={GAME_TYPES}
              labels={GAME_TYPE_LABELS}
              selected={gameType}
              onSelect={setGameType}
            />
          </View>
          <View style={styles.sortRow}>
            {SORTS.map(({ key, label }) => (
              <Pressable
                key={key}
                testID={`sort-${key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: sort === key }}
                style={[styles.sortChip, sort === key && styles.sortChipActive]}
                onPress={() => setSort(key)}
              >
                <Text style={[styles.sortChipText, sort === key && styles.sortChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={visible.length === 0 ? styles.emptyContent : styles.listContent}
        ListEmptyComponent={
          ranges.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No ranges yet</Text>
              <Link href="/editor" asChild>
                <Pressable testID="empty-new-range" style={styles.button}>
                  <Text style={styles.buttonText}>Create your first range</Text>
                </Pressable>
              </Link>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text testID="no-match" style={styles.emptyText}>
                No ranges match “{query}”
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View testID={`range-row-${item.id}`} style={styles.row}>
            <Link href={{ pathname: '/editor', params: { id: item.id } }} asChild>
              <Pressable style={styles.rowMain}>
                <Text style={styles.rowName}>{item.name || 'Untitled'}</Text>
                <Text style={styles.rowMeta}>
                  {item.hands.length} hands · {calculateRangePercentage(item.hands).toFixed(1)}%
                </Text>
              </Pressable>
            </Link>
            <Link href={{ pathname: '/practice', params: { id: item.id } }} asChild>
              <Pressable testID={`practice-${item.id}`} style={styles.practiceButton}>
                <Text style={styles.practiceText}>Practice</Text>
              </Pressable>
            </Link>
            <Pressable
              testID={`duplicate-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Duplicate ${item.name || 'Untitled'}`}
              onPress={() => handleDuplicate(item)}
              style={styles.duplicateButton}
            >
              <Text style={styles.duplicateText}>Copy</Text>
            </Pressable>
            <Pressable
              testID={`delete-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name || 'Untitled'}`}
              onPress={() => confirmDelete(item)}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerLink: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  search: {
    margin: 16,
    marginBottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textStrong,
    backgroundColor: colors.surface,
  },
  filters: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sortChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sortChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: colors.onAccent,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rowMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  rowName: {
    color: colors.textStrong,
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    color: colors.text,
    fontSize: 13,
  },
  practiceButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  practiceText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  duplicateButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  duplicateText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  deleteText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
