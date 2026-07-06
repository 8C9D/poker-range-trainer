import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack, useFocusEffect } from 'expo-router';

import {
  filterArchivedRanges,
  filterFavoriteRanges,
  filterRangesByActionType,
  filterRangesByGameType,
  filterRangesByName,
  filterRangesByPosition,
  sortRangesByAccuracy,
  sortRangesByLastPracticed,
  sortRangesByName,
  sortRangesByUpdatedAt,
} from '@core/domain/rangeLibrary';
import { practiceAccuracyPercentage } from '@core/domain/practiceStats';
import { duplicateRange } from '@core/domain/rangeDuplication';
import { calculateRangePercentage } from '@core/domain/rangeMath';
import { currentStreak, isReviewDue } from '@core/domain/spacedRepetition';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
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
  const [reviewStates, setReviewStates] = useState(() => loadReviewStates());
  const [sessionHistory, setSessionHistory] = useState(() => loadSessionHistory());
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<Position | undefined>(undefined);
  const [actionType, setActionType] = useState<ActionType | undefined>(undefined);
  const [gameType, setGameType] = useState<GameType | undefined>(undefined);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<SortKey>('updated');

  const reload = useCallback(() => {
    setRanges(loadSavedRanges());
    setPracticeStats(loadPracticeStats());
    setReviewStates(loadReviewStates());
    setSessionHistory(loadSessionHistory());
  }, []);

  // Reload whenever the screen regains focus (e.g. returning from the editor or practice).
  useFocusEffect(reload);

  // Spaced-repetition signals: the current practice streak across all ranges (from session
  // timestamps) and, per card, whether a previously-reviewed range is due again now.
  const now = new Date().toISOString();
  const streak = useMemo(
    () => currentStreak(Object.values(sessionHistory).flat().map((record) => record.playedAt), now),
    [sessionHistory, now],
  );

  // Search + metadata filters narrow the list; `ranges` stays the full loaded set.
  const filtered = useMemo(
    () =>
      filterFavoriteRanges(
        filterRangesByGameType(
          filterRangesByActionType(
            filterRangesByPosition(
              filterRangesByName(filterArchivedRanges(ranges, showArchived), query),
              position ?? null,
            ),
            actionType ?? null,
          ),
          gameType ?? null,
        ),
        favoritesOnly,
      ),
    [ranges, query, position, actionType, gameType, favoritesOnly, showArchived],
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

  const toggleFavorite = useCallback(
    (range: SavedRange) => {
      saveSavedRange({ ...range, favorite: !range.favorite });
      reload();
    },
    [reload],
  );

  const toggleArchive = useCallback(
    (range: SavedRange) => {
      saveSavedRange({ ...range, archived: !range.archived });
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
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <Link href="/board" style={styles.headerLink}>
                Boards
              </Link>
              <Link href="/diff" style={styles.headerLink}>
                Compare
              </Link>
            </View>
          ),
          headerRight: () => (
            <Link href="/editor" style={styles.headerLink}>
              New
            </Link>
          ),
        }}
      />
      {streak > 0 ? (
        <Text testID="practice-streak" style={styles.streak}>
          🔥 {streak}-day streak
        </Text>
      ) : null}
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
            <Pressable
              testID="filter-favorites"
              accessibilityRole="button"
              accessibilityState={{ selected: favoritesOnly }}
              onPress={() => setFavoritesOnly((value) => !value)}
              style={[styles.favFilter, favoritesOnly && styles.favFilterActive]}
            >
              <Text style={[styles.favFilterText, favoritesOnly && styles.favFilterTextActive]}>
                ★ Favorites
              </Text>
            </Pressable>
            <Pressable
              testID="toggle-archived"
              accessibilityRole="button"
              accessibilityState={{ selected: showArchived }}
              onPress={() => setShowArchived((value) => !value)}
              style={[styles.favFilter, showArchived && styles.favFilterActive]}
            >
              <Text style={[styles.favFilterText, showArchived && styles.favFilterTextActive]}>
                {showArchived ? 'Hide archived' : 'Show archived'}
              </Text>
            </Pressable>
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
        renderItem={({ item }) => {
          const stats = practiceStats[item.id];
          // Badge a range only once it has a review state and is due again — not the
          // never-reviewed default (which would badge nearly everything).
          const reviewState = reviewStates[item.id];
          const due = reviewState !== undefined && isReviewDue(reviewState, now);
          return (
          <View testID={`range-row-${item.id}`} style={styles.row}>
            <Pressable
              testID={`favorite-${item.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: !!item.favorite }}
              accessibilityLabel={`Favorite ${item.name || 'Untitled'}`}
              onPress={() => toggleFavorite(item)}
              style={styles.favoriteButton}
            >
              <Text style={[styles.favoriteIcon, item.favorite && styles.favoriteIconActive]}>
                {item.favorite ? '★' : '☆'}
              </Text>
            </Pressable>
            <Link href={{ pathname: '/editor', params: { id: item.id } }} asChild>
              <Pressable style={styles.rowMain}>
                <View style={styles.rowNameLine}>
                  <Text style={styles.rowName}>{item.name || 'Untitled'}</Text>
                  {due ? (
                    <Text testID={`due-${item.id}`} style={styles.dueBadge}>
                      Due
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.rowMeta}>
                  {item.hands.length} hands · {calculateRangePercentage(item.hands).toFixed(1)}%
                </Text>
                {stats && stats.totalAttempts > 0 ? (
                  <Text testID={`range-stats-${item.id}`} style={styles.rowStats}>
                    {stats.totalAttempts} attempts · {practiceAccuracyPercentage(stats).toFixed(0)}%
                    {' acc'}
                  </Text>
                ) : null}
              </Pressable>
            </Link>
            <Link href={{ pathname: '/practice-modes', params: { id: item.id } }} asChild>
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
              testID={`archive-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.archived ? 'Unarchive' : 'Archive'} ${item.name || 'Untitled'}`}
              onPress={() => toggleArchive(item)}
              style={styles.archiveButton}
            >
              <Text style={styles.archiveText}>{item.archived ? 'Unarchive' : 'Archive'}</Text>
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
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  headerLink: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  streak: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 12,
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
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    color: colors.textStrong,
    fontSize: 16,
    fontWeight: '600',
  },
  dueBadge: {
    color: colors.onAccent,
    backgroundColor: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  rowMeta: {
    color: colors.text,
    fontSize: 13,
  },
  rowStats: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
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
  archiveButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  archiveText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  favoriteButton: {
    paddingLeft: 12,
    paddingRight: 4,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  favoriteIcon: {
    color: colors.text,
    fontSize: 18,
  },
  favoriteIconActive: {
    color: colors.accent,
  },
  favFilter: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  favFilterActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  favFilterText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  favFilterTextActive: {
    color: colors.onAccent,
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
