import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

interface OverlayFrameProps {
  /** The range (or drill) name shown in the top bar. */
  title: string;
  /** Optional queue position, e.g. "2/5", shown next to the title. */
  position?: string | null;
  /** Progress toward the session's end, 0..1; omit to hide the bar. */
  progress?: number | null;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}

/**
 * The full-screen practice overlay chrome: close button, always-visible progress bar,
 * and the session title. Every practice mode renders inside this frame so the drill
 * language stays consistent. Themed via useTheme; fills the whole screen above the tabs.
 */
export function OverlayFrame({
  title,
  position = null,
  progress = null,
  onClose,
  closeLabel = 'Close practice',
  children,
}: OverlayFrameProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pct = progress === null ? null : Math.min(1, Math.max(0, progress));

  return (
    <View style={[styles.overlay, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          testID="overlay-close"
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          hitSlop={10}
          style={styles.close}
        >
          <Text style={[styles.closeText, { color: theme.ink2 }]}>×</Text>
        </Pressable>
        {pct !== null ? (
          <View
            testID="overlay-progress"
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
            style={[styles.progressTrack, { backgroundColor: theme.well }]}
          >
            <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: theme.goldFill }]} />
          </View>
        ) : (
          <View style={styles.progressSpacer} />
        )}
        <Text style={[styles.title, { color: theme.ink2 }]} numberOfLines={1}>
          {title}
          {position ? ` · ${position}` : ''}
        </Text>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  close: { width: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 28, lineHeight: 30, fontWeight: '400' },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressSpacer: { flex: 1 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 13, maxWidth: 120, fontVariant: ['tabular-nums'] },
  content: { flex: 1 },
});
