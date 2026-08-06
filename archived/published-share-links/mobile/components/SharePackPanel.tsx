import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import { publishSharedPack, unpublishSharedPack } from '@core/cloud/sharedPacksRepo';
import { buildRangePack } from '@core/domain/rangeTransfer';
import { loadSavedRanges } from '@core/storage/rangeStorage';

import { buildPackShareLink } from '../lib/shareLink';
import { useMobileSession } from '../lib/useMobileSession';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/**
 * Share-your-library panel (mobile parity with the web Account screen): a signed-in user can
 * publish every saved range as one shareable pack link (`p/:id`, public or token-guarded) and
 * unpublish it. Reuses `@core/cloud/sharedPacksRepo`; injects both the native client and a
 * client-bound `resolveUserId` because the repo's default resolver reads the web Vite env, which
 * is undefined on Hermes. Renders nothing when signed out / cloud unconfigured.
 */
export function SharePackPanel() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { client, session, resolveUserId } = useMobileSession();
  const [publishedPackId, setPublishedPackId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const publish = useCallback(
    async (isPublic: boolean) => {
      if (!client) return;
      const ranges = loadSavedRanges();
      if (ranges.length === 0) {
        setStatus('No ranges to publish yet.');
        return;
      }
      setStatus('Publishing pack…');
      try {
        const { id, token } = await publishSharedPack(buildRangePack('', ranges), isPublic, {
          client,
          resolveUserId,
        });
        setPublishedPackId(id);
        const link = buildPackShareLink(Linking.createURL, id, token);
        try {
          await Clipboard.setStringAsync(link);
          setStatus('Pack link copied to clipboard.');
        } catch {
          setStatus(`Pack link ready: ${link}`);
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Publish failed.');
      }
    },
    [client, resolveUserId],
  );

  const handlePublish = useCallback(() => {
    if (!client) return;
    Alert.alert(
      'Publish library pack',
      'Share your whole library as one link?\n\nPublic links open for anyone; private links carry a secret token.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Private', onPress: () => void publish(false) },
        { text: 'Public', onPress: () => void publish(true) },
      ],
    );
  }, [client, publish]);

  const handleUnpublish = useCallback(async () => {
    if (!client || !publishedPackId) return;
    setStatus('Unpublishing pack…');
    try {
      await unpublishSharedPack(publishedPackId, { client, resolveUserId });
      setPublishedPackId(null);
      setStatus('Pack link unpublished.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unpublish failed.');
    }
  }, [client, publishedPackId, resolveUserId]);

  if (!session) return null;

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Share your library</Text>
      <Text style={styles.muted}>Publish all your saved ranges as one shareable pack link.</Text>
      <View style={styles.row}>
        <Pressable
          testID="pack-publish"
          accessibilityRole="button"
          style={[styles.button, styles.flex1]}
          onPress={handlePublish}
        >
          <Text style={styles.buttonText}>Publish pack</Text>
        </Pressable>
        {publishedPackId ? (
          <Pressable
            testID="pack-unpublish"
            accessibilityRole="button"
            style={[styles.button, styles.secondary, styles.flex1]}
            onPress={handleUnpublish}
          >
            <Text style={styles.secondaryText}>Unpublish</Text>
          </Pressable>
        ) : null}
      </View>
      {status ? (
        <Text testID="pack-status" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    panel: { gap: 10 },
    sectionTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: theme.ink },
    muted: { fontFamily: fonts.body, fontSize: 14, color: theme.ink2 },
    row: { flexDirection: 'row', gap: 10 },
    flex1: { flex: 1 },
    button: { backgroundColor: theme.goldFill, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    secondary: { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line2 },
    buttonText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.onAccent },
    secondaryText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.ink },
    status: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.accentStrong },
  });
}
