import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { accuracyPercentage } from '@core/domain/accuracy';
import { calculateRangePercentage, countSelectedCombos } from '@core/domain/rangeMath';
import { duplicateRange } from '@core/domain/rangeDuplication';
import { setRangeArchived } from '@core/domain/rangeArchive';
import { setRangeFavorite } from '@core/domain/rangeFavorite';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import {
  deleteSavedRange,
  findSavedRangeById,
  saveSavedRange,
} from '@core/storage/rangeStorage';
import {
  ACTION_TYPE_LABELS,
  GAME_TYPE_LABELS,
  POSITION_LABELS,
  RANGE_SOURCE_KIND_LABELS,
  TABLE_SIZE_LABELS,
  type SavedRange,
} from '@core/types/range';

import { ActionsEditor } from '../../components/ActionsEditor';
import { ComboExplorer } from '../../components/ComboExplorer';
import { FrequenciesEditor } from '../../components/FrequenciesEditor';
import { RangeEditor } from '../../components/RangeEditor';
import { RangeThumbnail } from '../../components/RangeThumbnail';
import { Screen } from '../../components/Screen';
import { Chip } from '../../components/ui';
import { createRangeId } from '../../platform/createRangeId';
import { formatDayDistance } from '../../lib/format';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

const TABS = ['overview', 'edit', 'actions', 'combos', 'frequencies', 'stats'] as const;
type RangeTab = (typeof TABS)[number];
const TAB_LABELS: Record<RangeTab, string> = {
  overview: 'Overview',
  edit: 'Edit',
  actions: 'Actions',
  combos: 'Combos',
  frequencies: 'Frequencies',
  stats: 'Stats',
};

function metadataChips(range: SavedRange): string[] {
  const meta = range.metadata;
  const chips: string[] = [];
  if (meta?.gameType) chips.push(GAME_TYPE_LABELS[meta.gameType]);
  if (meta?.tableSize) chips.push(TABLE_SIZE_LABELS[meta.tableSize]);
  if (meta?.stackDepthBb !== undefined) chips.push(`${meta.stackDepthBb}bb`);
  if (meta?.position && meta?.versusPosition) {
    chips.push(`${POSITION_LABELS[meta.position]} vs ${POSITION_LABELS[meta.versusPosition]}`);
  } else if (meta?.position) {
    chips.push(POSITION_LABELS[meta.position]);
  } else if (meta?.versusPosition) {
    chips.push(`vs ${POSITION_LABELS[meta.versusPosition]}`);
  }
  if (meta?.actionType) chips.push(ACTION_TYPE_LABELS[meta.actionType]);
  if (range.favorite) chips.push('★ Favorite');
  if (range.archived) chips.push('Archived');
  return chips;
}

/**
 * The per-range page: header (back, name, chips, Practice, overflow menu) and the
 * Overview / Edit / Actions / Combos / Frequencies / Stats tabs. Overview + Edit are
 * inline; the remaining tabs link to the flat editors during the port (M5b/M5c inline
 * them). Mutations persist immediately and refresh the local copy from storage.
 */
export default function RangeScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [range, setRange] = useState<SavedRange | null>(() => findSavedRangeById(id) ?? null);
  const [tab, setTab] = useState<RangeTab>('overview');
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(() => {
    setRange(findSavedRangeById(id) ?? null);
  }, [id]);
  useFocusEffect(refresh);

  const selectTab = (next: RangeTab) => {
    setMenuOpen(false);
    refresh();
    setTab(next);
  };

  if (!range) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFound}>
          <Link href="/library" asChild>
            <Pressable>
              <Text style={styles.back}>← Library</Text>
            </Pressable>
          </Link>
          <Text style={styles.notFoundText}>This range does not exist (it may have been deleted).</Text>
        </View>
      </Screen>
    );
  }

  const chips = metadataChips(range);

  const doDuplicate = () => {
    const copy = duplicateRange(range, createRangeId(), new Date().toISOString());
    saveSavedRange(copy);
    setMenuOpen(false);
    router.replace({ pathname: '/range/[id]', params: { id: copy.id } });
  };
  const doToggleFavorite = () => {
    saveSavedRange(setRangeFavorite(range, !range.favorite));
    setMenuOpen(false);
    refresh();
  };
  const doToggleArchive = () => {
    saveSavedRange(setRangeArchived(range, !range.archived));
    setMenuOpen(false);
    refresh();
  };
  const doDelete = () => {
    setMenuOpen(false);
    Alert.alert('Delete range', `Delete "${range.name || 'Untitled'}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSavedRange(range.id);
          router.replace('/library');
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Link href="/library" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.back}>← Library</Text>
            </Pressable>
          </Link>
          <View style={styles.headerActions}>
            <Link href={{ pathname: '/practice-modes', params: { id: range.id } }} asChild>
              <Pressable testID="range-practice" style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Practice</Text>
              </Pressable>
            </Link>
            <Pressable
              testID="range-menu-button"
              accessibilityRole="button"
              accessibilityLabel="More actions"
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((open) => !open)}
              style={styles.menuButton}
            >
              <Text style={styles.menuButtonText}>⋯</Text>
            </Pressable>
          </View>
        </View>

        {menuOpen ? (
          <View testID="range-menu" style={styles.menu}>
            <MenuItem testID="menu-duplicate" label="Duplicate" onPress={doDuplicate} theme={theme} />
            <MenuItem
              testID="menu-favorite"
              label={range.favorite ? 'Unfavorite' : 'Favorite'}
              onPress={doToggleFavorite}
              theme={theme}
            />
            <MenuItem
              testID="menu-archive"
              label={range.archived ? 'Unarchive' : 'Archive'}
              onPress={doToggleArchive}
              theme={theme}
            />
            <Link href={{ pathname: '/diff', params: { id: range.id } }} asChild>
              <Pressable testID="menu-compare" style={styles.menuItem} onPress={() => setMenuOpen(false)}>
                <Text style={styles.menuItemText}>Compare…</Text>
              </Pressable>
            </Link>
            <MenuItem testID="menu-delete" label="Delete" onPress={doDelete} theme={theme} danger />
          </View>
        ) : null}

        <Text style={styles.title}>{range.name || 'Untitled'}</Text>
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map((chip) => (
              <Chip key={chip} label={chip} />
            ))}
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map((tabKey) => {
            const active = tab === tabKey;
            return (
              <Pressable
                key={tabKey}
                testID={`range-tab-${tabKey}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => selectTab(tabKey)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {TAB_LABELS[tabKey]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.tabContent}>
          {tab === 'overview' ? <OverviewTab range={range} theme={theme} styles={styles} /> : null}
          {tab === 'edit' ? <RangeEditor id={range.id} /> : null}
          {tab === 'actions' ? <ActionsEditor id={range.id} /> : null}
          {tab === 'combos' ? <ComboExplorer /> : null}
          {tab === 'frequencies' ? <FrequenciesEditor id={range.id} /> : null}
          {tab === 'stats' ? (
            <LinkCard
              label="Practice & stats"
              hint="Accuracy heatmap, weak hands, and session history."
              href={{ pathname: '/practice', params: { id: range.id } }}
              styles={styles}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function MenuItem({
  label,
  onPress,
  theme,
  danger,
  testID,
}: {
  label: string;
  onPress: () => void;
  theme: ThemeColors;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{ paddingHorizontal: 16, paddingVertical: 12 }}
    >
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: danger ? theme.bad : theme.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

function LinkCard({
  label,
  hint,
  href,
  styles,
}: {
  label: string;
  hint: string;
  href: React.ComponentProps<typeof Link>['href'];
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.linkCard}>
        <Text style={styles.linkCardLabel}>{label} →</Text>
        <Text style={styles.linkCardHint}>{hint}</Text>
      </Pressable>
    </Link>
  );
}

function OverviewTab({
  range,
  theme,
  styles,
}: {
  range: SavedRange;
  theme: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [history] = useState(() => loadSessionHistory()[range.id] ?? []);
  const [reviewState] = useState(() => loadReviewStates()[range.id]);
  const [nowIso] = useState(() => new Date().toISOString());

  const combos = countSelectedCombos(range.hands);
  const percentage = calculateRangePercentage(range.hands);
  const lastSession = history.length > 0 ? history[history.length - 1] : null;
  const recentSessions = history.slice(-5).reverse();
  const handNoteCount = Object.keys(range.handNotes ?? {}).length;

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.overviewCard}>
        <View style={styles.thumbWrap}>
          <RangeThumbnail hands={range.hands} size={260} />
        </View>
        <View style={styles.facts}>
          <Text style={styles.factLine}>
            {range.hands.length} hands · {combos} combos · {percentage.toFixed(1)}% of all hands
          </Text>
          <Text style={styles.factLine}>
            Next review:{' '}
            {reviewState && reviewState.dueAt
              ? new Date(reviewState.dueAt).toLocaleDateString()
              : 'not scheduled yet'}
          </Text>
          <Text style={styles.factLine}>
            Last session:{' '}
            {lastSession
              ? `${accuracyPercentage(lastSession.correctAnswers, lastSession.totalQuestions).toFixed(0)}% · ${formatDayDistance(lastSession.playedAt, nowIso)}`
              : 'none yet'}
          </Text>
          {range.metadata?.notes ? (
            <Text style={[styles.factLine, { color: theme.ink2 }]}>{range.metadata.notes}</Text>
          ) : null}
          {range.source ? (
            <Text style={styles.factLine}>
              Source: {RANGE_SOURCE_KIND_LABELS[range.source.kind]}
              {range.source.reference ? ` · ${range.source.reference}` : ''}
            </Text>
          ) : null}
          {handNoteCount > 0 ? (
            <Text style={styles.factLine}>
              {handNoteCount} hand note{handNoteCount === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      </View>

      {recentSessions.length > 0 ? (
        <View style={styles.overviewCard}>
          <Text style={styles.sectionTitle}>Recent sessions</Text>
          {recentSessions.map((session) => (
            <View key={session.playedAt} style={styles.sessionRow}>
              <Text style={styles.sessionDate}>{new Date(session.playedAt).toLocaleDateString()}</Text>
              <Text style={styles.sessionScore}>
                {session.correctAnswers}/{session.totalQuestions} ·{' '}
                {accuracyPercentage(session.correctAnswers, session.totalQuestions).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    scroll: { padding: 16, gap: 14, paddingBottom: 40 },
    notFound: { flex: 1, padding: 24, gap: 16 },
    notFoundText: { fontFamily: fonts.body, fontSize: 15, color: theme.ink2 },
    back: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.accent },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    primaryBtn: {
      backgroundColor: theme.goldFill,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    primaryBtnText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.onAccent },
    menuButton: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.card,
    },
    menuButtonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink, lineHeight: 18 },
    menu: {
      backgroundColor: theme.card,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      overflow: 'hidden',
    },
    menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
    menuItemText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: theme.ink },
    title: { fontFamily: fonts.display, fontSize: 28, color: theme.ink },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tabBar: {
      gap: 2,
      backgroundColor: theme.well,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 10,
      padding: 2,
    },
    tab: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    tabActive: { backgroundColor: theme.card },
    tabText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: theme.ink2 },
    tabTextActive: { color: theme.ink },
    tabContent: { marginTop: 2 },
    linkCard: {
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      padding: 18,
      gap: 6,
    },
    linkCardLabel: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.accent },
    linkCardHint: { fontFamily: fonts.body, fontSize: 14, color: theme.ink2 },
    overviewCard: {
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    thumbWrap: { alignItems: 'center' },
    facts: { gap: 6 },
    factLine: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: theme.ink,
      fontVariant: ['tabular-nums'],
    },
    sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.ink },
    sessionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    sessionDate: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    sessionScore: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: theme.ink,
      fontVariant: ['tabular-nums'],
    },
  });
}
