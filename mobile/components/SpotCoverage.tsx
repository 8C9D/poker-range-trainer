import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { distinctStackDepths } from '@core/domain/rangeLibrary';
import { encodeScenarioParams } from '@core/domain/scenarioParams';
import {
  SPOT_SITUATIONS,
  SPOT_SITUATION_LABELS,
  describeSpot,
  seatsForTableSize,
  spotKey,
  spotPrefillMetadata,
  type SpotSituation,
} from '@core/domain/spot';
import { buildSpotCoverage, inferLibraryContext } from '@core/domain/spotCoverage';
import {
  POSITION_LABELS,
  TABLE_SIZES,
  TABLE_SIZE_LABELS,
  type Position,
  type SavedRange,
  type TableSize,
} from '@core/types/range';

import { Segmented } from './ui';
import type { SegmentedOption } from './ui';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/** Stack depths always offered, so a thin library still has formats to inspect. */
const COMMON_DEPTHS = [20, 40, 100, 200];

const TABLE_OPTIONS: readonly SegmentedOption<TableSize>[] = TABLE_SIZES.map((size) => ({
  key: size,
  label: TABLE_SIZE_LABELS[size],
}));

/**
 * The v8.1 coverage map (mobile mirror of the web Library card): a seat-by-situation
 * grid of which standard preflop spots the library answers. Tapping a cell lists its
 * spots, each either naming the covering range or opening a new range pre-filled with
 * that spot's metadata.
 */
export function SpotCoverage({ ranges }: { ranges: SavedRange[] }) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const inferred = useMemo(() => inferLibraryContext(ranges), [ranges]);
  const [tableSize, setTableSize] = useState<TableSize>(inferred.tableSize);
  const [stackDepthBb, setStackDepthBb] = useState(inferred.stackDepthBb);
  const [openCell, setOpenCell] = useState<string | undefined>(undefined);

  const depthOptions = useMemo<SegmentedOption<number>[]>(
    () =>
      [...new Set([...COMMON_DEPTHS, ...distinctStackDepths(ranges), stackDepthBb])]
        .sort((a, b) => a - b)
        .map((depth) => ({ key: depth, label: `${depth}bb` })),
    [ranges, stackDepthBb],
  );
  const report = useMemo(
    () => buildSpotCoverage(ranges, tableSize, stackDepthBb),
    [ranges, tableSize, stackDepthBb],
  );

  const seats = seatsForTableSize(tableSize);
  const cellAt = (position: Position, situation: SpotSituation) =>
    report.cells.find((cell) => cell.position === position && cell.situation === situation);
  const selected = report.cells.find(
    (cell) => `${cell.position}/${cell.situation}` === openCell,
  );

  return (
    <View testID="spot-coverage" style={styles.card}>
      <Text style={styles.sectionTitle}>Spot coverage</Text>

      <Segmented
        options={TABLE_OPTIONS}
        value={tableSize}
        onSelect={(next) => {
          if (!next) return;
          setTableSize(next);
          setOpenCell(undefined);
        }}
        testIdPrefix="coverage-table"
      />
      <Segmented
        options={depthOptions}
        value={stackDepthBb}
        onSelect={(next) => {
          if (next === undefined) return;
          setStackDepthBb(next);
          setOpenCell(undefined);
        }}
        testIdPrefix="coverage-stack"
      />

      <View style={styles.summaryRow}>
        <Text testID="coverage-summary" style={styles.summary}>
          {report.covered} of {report.total} standard spots covered ·{' '}
          {report.coveragePercentage.toFixed(0)}%
        </Text>
        {report.covered > 0 ? (
          <Link
            href={{
              pathname: '/practice',
              params: { mode: 'spots', table: tableSize, stack: String(stackDepthBb) },
            }}
            asChild
          >
            <Pressable testID="play-spots" accessibilityRole="button" style={styles.playBtn}>
              <Text style={styles.playBtnText}>Play these spots</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>

      {/* Five situations do not fit a phone; the grid scrolls, not the screen. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.row}>
            <Text style={[styles.headCell, styles.seatCell]}>Seat</Text>
            {SPOT_SITUATIONS.map((situation) => (
              <Text key={situation} style={[styles.headCell, styles.cell]} numberOfLines={2}>
                {SPOT_SITUATION_LABELS[situation]}
              </Text>
            ))}
          </View>
          {seats.map((position) => (
            <View key={position} style={styles.row}>
              <Text style={[styles.seatCell, styles.seatText]}>{POSITION_LABELS[position]}</Text>
              {SPOT_SITUATIONS.map((situation) => {
                const cell = cellAt(position, situation);
                if (!cell) {
                  return (
                    <View key={situation} style={styles.cell}>
                      <Text style={styles.noSpot}>–</Text>
                    </View>
                  );
                }
                const key = `${position}/${situation}`;
                const full = cell.covered === cell.total;
                const empty = cell.covered === 0;
                return (
                  <View key={situation} style={styles.cell}>
                    <Pressable
                      testID={`coverage-${position}-${situation}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: openCell === key }}
                      accessibilityLabel={`${POSITION_LABELS[position]} ${SPOT_SITUATION_LABELS[
                        situation
                      ].toLowerCase()}: ${cell.covered} of ${cell.total} covered`}
                      onPress={() => setOpenCell(openCell === key ? undefined : key)}
                      style={[
                        styles.cellBtn,
                        {
                          backgroundColor: full ? theme.accentSoft : empty ? theme.cellbg : theme.well,
                          borderColor:
                            openCell === key ? theme.accent : full ? theme.accent : theme.line,
                          borderStyle: empty ? 'dashed' : 'solid',
                        },
                      ]}
                    >
                      <Text style={[styles.cellText, { color: empty ? theme.ink3 : theme.ink }]}>
                        {cell.covered}/{cell.total}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {selected ? (
        <View testID="coverage-detail" style={styles.detail}>
          {selected.entries.map((entry) => (
            <View key={spotKey(entry.spot)} style={styles.detailRow}>
              <Text style={styles.detailText}>{describeSpot(entry.spot)}</Text>
              {entry.match ? (
                <Link
                  href={{ pathname: '/range/[id]', params: { id: entry.match.range.id } }}
                  asChild
                >
                  <Text style={styles.detailLink} numberOfLines={1}>
                    {entry.match.range.name}
                  </Text>
                </Link>
              ) : (
                <Link
                  href={{
                    pathname: '/range/new',
                    params: encodeScenarioParams(spotPrefillMetadata(entry.spot)),
                  }}
                  asChild
                >
                  <Text testID={`coverage-create-${spotKey(entry.spot)}`} style={styles.detailBtn}>
                    Create
                  </Text>
                </Link>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      padding: 16,
      gap: 10,
    },
    sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.ink },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    playBtn: {
      backgroundColor: theme.goldFill,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    playBtnText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: theme.onAccent },
    summary: {
      flexShrink: 1,
      fontFamily: fonts.body,
      fontSize: 13,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    row: { flexDirection: 'row', alignItems: 'stretch' },
    seatCell: { width: 44, justifyContent: 'center' },
    seatText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: theme.ink2,
      alignSelf: 'center',
      paddingVertical: 8,
    },
    cell: { width: 66, padding: 2, justifyContent: 'center' },
    headCell: {
      fontFamily: fonts.body,
      fontSize: 10.5,
      color: theme.ink3,
      textAlign: 'center',
      paddingBottom: 4,
    },
    cellBtn: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
    },
    cellText: { fontFamily: fonts.bodyMedium, fontSize: 12, fontVariant: ['tabular-nums'] },
    noSpot: { fontFamily: fonts.body, fontSize: 12, color: theme.ink3, textAlign: 'center' },
    detail: { gap: 8, marginTop: 4 },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.line,
    },
    detailText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: theme.ink2 },
    detailLink: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: theme.accentStrong },
    detailBtn: { fontFamily: fonts.bodySemibold, fontSize: 13, color: theme.accentStrong },
  });
}
