import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { documentDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { publishSharedRange, unpublishSharedRange } from '@core/cloud/sharedRangesRepo';
import { accuracyPercentage } from '@core/domain/accuracy';
import { describeRangeChart, formatRangeNotation } from '@core/domain/rangeNotation';
import {
  encodeRangeToHash,
  formatRangeCsv,
  serializeRangeExport,
} from '@core/domain/rangeTransfer';

import { countRangeCombos, rangeComboPercentage } from '@core/domain/comboSelection';
import { duplicateRange } from '@core/domain/rangeDuplication';
import { setRangeArchived } from '@core/domain/rangeArchive';
import { setRangeFavorite } from '@core/domain/rangeFavorite';
import { sourceReferenceUrl } from '@core/domain/sourceReference';
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
import { SaveErrorBanner, useLiveSave } from '../../components/liveSave';
import { RangeEditor } from '../../components/RangeEditor';
import { RangeStats } from '../../components/RangeStats';
import { RangeThumbnail } from '../../components/RangeThumbnail';
import { Screen } from '../../components/Screen';
import { Chip } from '../../components/ui';
import { createRangeId } from '../../platform/createRangeId';
import { buildOfflineRangeLink, buildRangeShareLink } from '../../lib/shareLink';
import { useMobileSession } from '../../lib/useMobileSession';
import { formatDayDistance, safeRangeFileName } from '../../lib/format';
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
  const { client, session, resolveUserId } = useMobileSession();
  const [publishedShareId, setPublishedShareId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const [actionError, runSave] = useLiveSave();

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

  // Each menu action persists first: a device store that is full or unavailable
  // throws, and without this the menu item would just close having done nothing.
  const doDuplicate = () => {
    const copy = duplicateRange(range, createRangeId(), new Date().toISOString());
    setMenuOpen(false);
    if (!runSave(() => saveSavedRange(copy))) return;
    router.replace({ pathname: '/range/[id]', params: { id: copy.id } });
  };
  const doToggleFavorite = () => {
    setMenuOpen(false);
    if (!runSave(() => saveSavedRange(setRangeFavorite(range, !range.favorite)))) return;
    refresh();
  };
  const doToggleArchive = () => {
    setMenuOpen(false);
    if (!runSave(() => saveSavedRange(setRangeArchived(range, !range.archived)))) return;
    refresh();
  };
  const copyText = (text: string, label: string) => {
    setMenuOpen(false);
    Clipboard.setStringAsync(text)
      .then(() => Alert.alert('Copied', `${label} copied to clipboard.`))
      .catch(() => Alert.alert('Copy failed', 'Could not copy to the clipboard.'));
  };
  // Write the range's export envelope to a file and hand it to the share sheet, so it can
  // land in Files/Mail/another device and be picked back up by the Account tab's importer.
  const doExportFile = () => {
    setMenuOpen(false);
    void (async () => {
      try {
        const uri = `${documentDirectory ?? ''}${safeRangeFileName(range.name)}.json`;
        await writeAsStringAsync(uri, serializeRangeExport(range));
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
          setShareStatus('Exported the range file.');
        } else {
          setShareStatus(`Saved the range to ${uri}`);
        }
      } catch (error) {
        setShareStatus(error instanceof Error ? error.message : 'Export failed.');
      }
    })();
  };
  const doDelete = () => {
    setMenuOpen(false);
    Alert.alert('Delete range', `Delete "${range.name || 'Untitled'}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!runSave(() => deleteSavedRange(range.id))) return;
          router.replace('/library');
        },
      },
    ]);
  };

  const publish = async (isPublic: boolean) => {
    if (!client) return;
    setShareStatus('Publishing…');
    try {
      const { id: shareId, token } = await publishSharedRange(range, isPublic, { client, resolveUserId });
      setPublishedShareId(shareId);
      const link = buildRangeShareLink(Linking.createURL, shareId, token);
      try {
        await Clipboard.setStringAsync(link);
        setShareStatus('Share link copied to clipboard.');
      } catch {
        setShareStatus(`Share link ready: ${link}`);
      }
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Publish failed.');
    }
  };
  const doPublish = () => {
    setMenuOpen(false);
    if (!client) return;
    Alert.alert(
      'Publish share link',
      `Share "${range.name || 'Untitled'}" as a link?\n\nPublic links open for anyone; private links carry a secret token.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Private', onPress: () => void publish(false) },
        { text: 'Public', onPress: () => void publish(true) },
      ],
    );
  };
  const doUnpublish = async () => {
    setMenuOpen(false);
    if (!client || !publishedShareId) return;
    setShareStatus('Unpublishing…');
    try {
      await unpublishSharedRange(publishedShareId, { client, resolveUserId });
      setPublishedShareId(null);
      setShareStatus('Shared link unpublished.');
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Unpublish failed.');
    }
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
            <Link href={{ pathname: '/practice', params: { id: range.id } }} asChild>
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
            <MenuItem
              testID="menu-copy-notation"
              label="Copy notation"
              onPress={() => copyText(formatRangeNotation(range.hands), 'Range notation')}
              theme={theme}
            />
            <MenuItem
              testID="menu-copy-csv"
              label="Copy CSV"
              onPress={() => copyText(formatRangeCsv(range), 'Range CSV')}
              theme={theme}
            />
            <MenuItem
              testID="menu-export-file"
              label="Export range file"
              onPress={doExportFile}
              theme={theme}
            />
            <MenuItem
              testID="menu-copy-share-link"
              label="Copy share link"
              onPress={() =>
                copyText(
                  buildOfflineRangeLink(Linking.createURL, encodeRangeToHash(range)),
                  'Share link',
                )
              }
              theme={theme}
            />
            {session ? (
              <>
                <MenuItem testID="menu-publish" label="Publish link" onPress={doPublish} theme={theme} />
                {publishedShareId ? (
                  <MenuItem
                    testID="menu-unpublish"
                    label="Unpublish link"
                    onPress={doUnpublish}
                    theme={theme}
                  />
                ) : null}
              </>
            ) : null}
            <MenuItem testID="menu-delete" label="Delete" onPress={doDelete} theme={theme} danger />
          </View>
        ) : null}

        {shareStatus ? (
          <Text testID="range-share-status" style={styles.shareStatus}>
            {shareStatus}
          </Text>
        ) : null}
        <SaveErrorBanner error={actionError} testID="range-action-error" />

        <Text accessibilityRole="header" style={styles.title}>{range.name || 'Untitled'}</Text>
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
          {tab === 'stats' ? <RangeStats id={range.id} /> : null}
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

function OverviewTab({
  range,
  theme,
  styles,
}: {
  range: SavedRange;
  theme: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [history, setHistory] = useState(() => loadSessionHistory()[range.id] ?? []);
  const [reviewState, setReviewState] = useState(() => loadReviewStates()[range.id]);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());

  // The tab stays mounted while the user leaves to practice and returns, so
  // re-read the session/review snapshot on focus instead of only at mount.
  useFocusEffect(
    useCallback(() => {
      setHistory(loadSessionHistory()[range.id] ?? []);
      setReviewState(loadReviewStates()[range.id]);
      setNowIso(new Date().toISOString());
    }, [range.id]),
  );

  const combos = countRangeCombos(range.hands, range.comboSelections);
  const percentage = rangeComboPercentage(range.hands, range.comboSelections);
  const lastSession = history.length > 0 ? history[history.length - 1] : null;
  const recentSessions = history.slice(-5).reverse();
  const handNoteCount = Object.keys(range.handNotes ?? {}).length;
  const sourceUrl = sourceReferenceUrl(range.source?.reference);

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.overviewCard}>
        <View style={styles.thumbWrap}>
          <RangeThumbnail hands={range.hands} size={260} label={describeRangeChart(range.hands)} />
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
            sourceUrl && range.source.reference ? (
              <View style={styles.sourceRow}>
                <Text style={styles.factLine}>
                  Source: {RANGE_SOURCE_KIND_LABELS[range.source.kind]} ·{' '}
                </Text>
                <Pressable
                  testID="source-reference-link"
                  accessibilityRole="link"
                  accessibilityLabel={`Open source ${range.source.reference}`}
                  onPress={() => void Linking.openURL(sourceUrl)}
                >
                  <Text style={styles.sourceLink}>{range.source.reference}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.factLine}>
                Source: {RANGE_SOURCE_KIND_LABELS[range.source.kind]}
                {range.source.reference ? ` · ${range.source.reference}` : ''}
              </Text>
            )
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
          <Text accessibilityRole="header" style={styles.sectionTitle}>Recent sessions</Text>
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
    shareStatus: { fontFamily: fonts.bodySemibold, fontSize: 13, color: theme.accent },
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
    sourceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
    sourceLink: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: theme.accent,
      textDecorationLine: 'underline',
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
