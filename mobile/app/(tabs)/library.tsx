import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';

import {
  distinctStackDepths,
  filterArchivedRanges,
  filterFavoriteRanges,
  filterRangesByActionType,
  filterRangesByGameType,
  filterRangesByName,
  filterRangesByPosition,
  filterRangesByStackDepth,
  sortRangesByAccuracy,
  sortRangesByLastPracticed,
  sortRangesByName,
  sortRangesByUpdatedAt,
} from '@core/domain/rangeLibrary';
import { calculateRangePercentage } from '@core/domain/rangeMath';
import { practiceAccuracyPercentage } from '@core/domain/practiceStats';
import { selectDueRanges } from '@core/domain/spacedRepetition';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSavedRanges } from '@core/storage/rangeStorage';
import {
  ACTION_TYPE_LABELS,
  ACTION_TYPES,
  GAME_TYPE_LABELS,
  GAME_TYPES,
  POSITION_LABELS,
  POSITIONS,
  type ActionType,
  type GameType,
  type Position,
  type SavedRange,
} from '@core/types/range';

import { RangeThumbnail } from '../../components/RangeThumbnail';
import { Screen } from '../../components/Screen';
import { Chip, Segmented } from '../../components/ui';
import type { SegmentedOption } from '../../components/ui';
import { formatDayDistance } from '../../lib/format';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

type SortOrder = 'name' | 'recent' | 'practiced' | 'accuracy';

const SORT_OPTIONS: readonly SegmentedOption<SortOrder>[] = [
  { key: 'name', label: 'Name' },
  { key: 'recent', label: 'Recent' },
  { key: 'practiced', label: 'Practiced' },
  { key: 'accuracy', label: 'Accuracy' },
];

const POSITION_OPTIONS = POSITIONS.map((p) => ({ key: p, label: POSITION_LABELS[p] }));
const ACTION_OPTIONS = ACTION_TYPES.map((a) => ({ key: a, label: ACTION_TYPE_LABELS[a] }));
const GAME_OPTIONS = GAME_TYPES.map((g) => ({ key: g, label: GAME_TYPE_LABELS[g] }));

function loadLibraryState() {
  return {
    ranges: loadSavedRanges(),
    practiceStats: loadPracticeStats(),
    reviewStates: loadReviewStates(),
    nowIso: new Date().toISOString(),
  };
}

/**
 * The Library: search (always visible), a collapsible of metadata filters + sort +
 * favorites/archived toggles, and thumbnail rows that open the per-range page. Data is
 * reloaded on focus (every mutation lives on the Range page). Rows link to `/editor`
 * transitionally until the Range page lands (M5), then re-point to `range/[id]`.
 */
export default function LibraryScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [{ ranges, practiceStats, reviewStates, nowIso }, setData] = useState(loadLibraryState);
  useFocusEffect(
    useCallback(() => {
      setData(loadLibraryState());
    }, []),
  );

  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [position, setPosition] = useState<Position | undefined>(undefined);
  const [actionType, setActionType] = useState<ActionType | undefined>(undefined);
  const [stackDepth, setStackDepth] = useState<number | undefined>(undefined);
  const [gameType, setGameType] = useState<GameType | undefined>(undefined);
  const [sort, setSort] = useState<SortOrder | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const stackOptions = useMemo<SegmentedOption<number>[]>(
    () => distinctStackDepths(ranges).map((d) => ({ key: d, label: `${d}bb` })),
    [ranges],
  );

  const dueIds = useMemo(
    () =>
      new Set(
        selectDueRanges(
          ranges.filter((range) => !range.archived),
          reviewStates,
          nowIso,
        ).map((range) => range.id),
      ),
    [ranges, reviewStates, nowIso],
  );

  const visibleRanges = useMemo(() => {
    // Same pipeline as the web library: archived drop out first (unless revealed),
    // then favorites-only, then the name/metadata filters narrow.
    const filtered = filterRangesByGameType(
      filterRangesByStackDepth(
        filterRangesByActionType(
          filterRangesByPosition(
            filterRangesByName(
              filterFavoriteRanges(filterArchivedRanges(ranges, showArchived), favoritesOnly),
              query,
            ),
            position ?? null,
          ),
          actionType ?? null,
        ),
        stackDepth ?? null,
      ),
      gameType ?? null,
    );
    switch (sort) {
      case 'name':
        return sortRangesByName(filtered);
      case 'recent':
        return sortRangesByUpdatedAt(filtered);
      case 'practiced':
        return sortRangesByLastPracticed(filtered, practiceStats);
      case 'accuracy':
        return sortRangesByAccuracy(filtered, practiceStats);
      default:
        return filtered;
    }
  }, [
    ranges,
    showArchived,
    favoritesOnly,
    query,
    position,
    actionType,
    stackDepth,
    gameType,
    sort,
    practiceStats,
  ]);

  const activeFilterCount =
    (position ? 1 : 0) +
    (actionType ? 1 : 0) +
    (stackDepth !== undefined ? 1 : 0) +
    (gameType ? 1 : 0) +
    (favoritesOnly ? 1 : 0) +
    (showArchived ? 1 : 0);

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Library</Text>
        <Link href="/range/new" asChild>
          <Pressable testID="new-range" style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>New range</Text>
          </Pressable>
        </Link>
      </View>

      {ranges.length === 0 ? null : (
        <>
          <TextInput
            testID="library-search"
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search ranges"
            placeholderTextColor={theme.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <Pressable
            testID="filters-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((open) => !open)}
            style={styles.filtersToggle}
          >
            <Text style={styles.filtersToggleText}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </Pressable>

          {filtersOpen ? (
            <View style={styles.filters}>
              <FilterGroup label="Sort" theme={theme}>
                <Segmented options={SORT_OPTIONS} value={sort} onSelect={setSort} testIdPrefix="sort" />
              </FilterGroup>
              <FilterGroup label="Position" theme={theme}>
                <Segmented
                  options={POSITION_OPTIONS}
                  value={position}
                  onSelect={setPosition}
                  testIdPrefix="filter-position"
                />
              </FilterGroup>
              <FilterGroup label="Action" theme={theme}>
                <Segmented
                  options={ACTION_OPTIONS}
                  value={actionType}
                  onSelect={setActionType}
                  testIdPrefix="filter-action"
                />
              </FilterGroup>
              {stackOptions.length > 0 ? (
                <FilterGroup label="Stack" theme={theme}>
                  <Segmented
                    options={stackOptions}
                    value={stackDepth}
                    onSelect={setStackDepth}
                    testIdPrefix="filter-stack"
                  />
                </FilterGroup>
              ) : null}
              <FilterGroup label="Game" theme={theme}>
                <Segmented
                  options={GAME_OPTIONS}
                  value={gameType}
                  onSelect={setGameType}
                  testIdPrefix="filter-game"
                />
              </FilterGroup>
              <View style={styles.toggles}>
                <Toggle
                  testID="filter-favorites"
                  label="Favorites only"
                  on={favoritesOnly}
                  onPress={() => setFavoritesOnly((on) => !on)}
                  theme={theme}
                />
                <Toggle
                  testID="toggle-archived"
                  label={showArchived ? 'Hide archived' : 'Show archived'}
                  on={showArchived}
                  onPress={() => setShowArchived((on) => !on)}
                  theme={theme}
                />
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={visibleRanges}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <RangeRow
            range={item}
            stats={practiceStats[item.id]}
            due={dueIds.has(item.id)}
            nowIso={nowIso}
            theme={theme}
            styles={styles}
          />
        )}
        ListEmptyComponent={
          ranges.length === 0 ? (
            <View testID="library-empty" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No ranges yet</Text>
              <Text style={styles.emptyBody}>
                Create your first range and it will show up here, ready to train.
              </Text>
            </View>
          ) : (
            <Text testID="no-match" style={styles.noMatch}>
              {query.trim()
                ? `No ranges match “${query.trim()}”.`
                : 'No ranges match the selected filters.'}
            </Text>
          )
        }
      />
    </Screen>
  );
}

function FilterGroup({
  label,
  theme,
  children,
}: {
  label: string;
  theme: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 12, color: theme.ink3 }}>{label}</Text>
      {children}
    </View>
  );
}

function Toggle({
  label,
  on,
  onPress,
  theme,
  testID,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  theme: ThemeColors;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.line2,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: on ? theme.line2 : theme.card,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: on ? theme.ink : theme.ink2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function RangeRow({
  range,
  stats,
  due,
  nowIso,
  theme,
  styles,
}: {
  range: SavedRange;
  stats: ReturnType<typeof loadPracticeStats>[string] | undefined;
  due: boolean;
  nowIso: string;
  theme: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const meta = range.metadata;
  const percentage = calculateRangePercentage(range.hands);
  return (
    <Link href={{ pathname: '/range/[id]', params: { id: range.id } }} asChild>
      <Pressable
        testID={`range-row-${range.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Open range ${range.name || 'Untitled'}`}
        style={styles.row}
      >
        <RangeThumbnail hands={range.hands} size={44} />
        <View style={styles.rowInfo}>
          <View style={styles.rowNameLine}>
            {range.favorite ? (
              <Text style={styles.rowStar} accessibilityLabel="Favorite">
                ★
              </Text>
            ) : null}
            <Text style={styles.rowName} numberOfLines={1}>
              {range.name || 'Untitled'}
            </Text>
          </View>
          <View style={styles.rowChips}>
            {meta?.position ? (
              <Chip
                label={`${POSITION_LABELS[meta.position]}${meta.versusPosition ? ` vs ${POSITION_LABELS[meta.versusPosition]}` : ''}`}
              />
            ) : null}
            {meta?.actionType ? <Chip label={ACTION_TYPE_LABELS[meta.actionType]} /> : null}
            <Chip label={`${percentage.toFixed(1)}%`} />
            {due ? <Chip label="Due" tone="due" testID={`due-${range.id}`} /> : null}
            {range.archived ? <Chip label="Archived" /> : null}
          </View>
        </View>
        <View style={styles.rowStats}>
          {stats && stats.totalAttempts > 0 ? (
            <>
              <Text testID={`range-stats-${range.id}`} style={styles.rowAccuracy}>
                {practiceAccuracyPercentage(stats).toFixed(0)}%
              </Text>
              <Text style={styles.rowPracticed}>{formatDayDistance(stats.lastPracticedAt, nowIso)}</Text>
            </>
          ) : (
            <Text style={styles.rowPracticed}>Not practiced</Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    listContent: { padding: 16, gap: 12, paddingBottom: 32 },
    header: { gap: 12, marginBottom: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontFamily: fonts.display, fontSize: 30, color: theme.ink },
    primaryBtn: {
      backgroundColor: theme.goldFill,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    primaryBtnText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.onAccent },
    search: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: fonts.body,
      color: theme.ink,
      backgroundColor: theme.card,
    },
    filtersToggle: {
      alignSelf: 'flex-start',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.card,
    },
    filtersToggleText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.ink },
    filters: { gap: 12 },
    toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      padding: 12,
    },
    rowInfo: { flex: 1, gap: 6 },
    rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowStar: { fontSize: 14, color: theme.accent },
    rowName: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.ink, flexShrink: 1 },
    rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    rowStats: { alignItems: 'flex-end', gap: 2 },
    rowAccuracy: {
      fontFamily: fonts.bodySemibold,
      fontSize: 16,
      color: theme.ink,
      fontVariant: ['tabular-nums'],
    },
    rowPracticed: { fontFamily: fonts.body, fontSize: 12.5, color: theme.ink2 },
    emptyCard: {
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      padding: 20,
      gap: 8,
      margin: 16,
    },
    emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: theme.ink },
    emptyBody: { fontFamily: fonts.body, fontSize: 15, color: theme.ink2 },
    noMatch: { fontFamily: fonts.body, fontSize: 15, color: theme.ink2, padding: 16 },
  });
}
