import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getCurrentSession, onAuthChange, signIn, signOut, signUp } from '@core/cloud/auth';
import { deleteBackup, pullBackup, pushBackup } from '@core/cloud/backupRepo';
import { buildBackup, restoreBackup } from '@core/storage/backup';

import { getMobileSupabaseClient } from '../platform/supabaseClient';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/**
 * Account + cloud-sync panel: sign up / in / out over the reused `@core/cloud/auth` with the
 * native Supabase client, then push/pull the whole library (pull confirms before overwriting
 * local) and delete the cloud copy. Local-first: when cloud is unconfigured the client is null
 * and the panel shows an offline message. All auth/sync logic lives in `@core`.
 */
export function AuthPanel() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  // `undefined` = still resolving the client; `null` = cloud unconfigured.
  const [client, setClient] = useState<SupabaseClient | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    (async () => {
      const resolved = await getMobileSupabaseClient();
      if (!active) return;
      setClient(resolved);
      if (resolved) {
        setSession(await getCurrentSession(resolved));
        unsubscribe = await onAuthChange((next) => {
          if (active) setSession(next);
        }, resolved);
      }
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const run = useCallback(async (op: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await op();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSignIn = useCallback(() => {
    if (!client) return;
    void run(async () => setSession(await signIn(email.trim(), password, client)));
  }, [client, email, password, run]);

  const handleSignUp = useCallback(() => {
    if (!client) return;
    void run(async () => setSession(await signUp(email.trim(), password, client)));
  }, [client, email, password, run]);

  const handleSignOut = useCallback(() => {
    if (!client) return;
    void run(async () => {
      await signOut(client);
      setSession(null);
    });
  }, [client, run]);

  const handlePush = useCallback(() => {
    if (!client) return;
    void run(async () => {
      await pushBackup(buildBackup(), { client });
      setSyncStatus('Pushed your library to the cloud.');
    });
  }, [client, run]);

  const doPull = useCallback(() => {
    if (!client) return;
    void run(async () => {
      const cloud = await pullBackup({ client });
      if (cloud) {
        restoreBackup(cloud);
        const count = cloud.ranges.length;
        setSyncStatus(`Restored ${count} range${count === 1 ? '' : 's'} from the cloud.`);
      } else {
        setSyncStatus('Nothing in the cloud yet.');
      }
    });
  }, [client, run]);

  // Confirm before overwriting the local library with the cloud copy.
  const handlePull = useCallback(() => {
    Alert.alert(
      'Pull from cloud',
      'Replace your library on this device with the cloud copy? Local-only changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pull', style: 'destructive', onPress: doPull },
      ],
    );
  }, [doPull]);

  const handleDelete = useCallback(() => {
    if (!client) return;
    Alert.alert(
      'Delete cloud data',
      'Remove your cloud backup? This clears only the cloud copy — your ranges stay on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              await deleteBackup({ client });
              setSyncStatus('Deleted your cloud backup.');
            }),
        },
      ],
    );
  }, [client, run]);

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Account & sync</Text>
      {client === undefined ? (
        <Text style={styles.muted}>Connecting…</Text>
      ) : client === null ? (
        <Text testID="auth-offline" style={styles.offline}>
          Cloud sync is not configured — the app runs fully offline. Set EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY to enable accounts and sync.
        </Text>
      ) : session ? (
        <View style={styles.block}>
          <Text style={styles.label}>Signed in as</Text>
          <Text testID="auth-session" style={styles.email}>
            {session.user?.email ?? 'your account'}
          </Text>
          <Pressable
            testID="auth-signout"
            accessibilityRole="button"
            disabled={busy}
            style={[styles.button, styles.secondary, busy && styles.buttonDisabled]}
            onPress={handleSignOut}
          >
            <Text style={styles.secondaryText}>Sign out</Text>
          </Pressable>

          <View style={styles.divider} />
          <Text style={styles.label}>Library sync</Text>
          <Text style={styles.muted}>
            Push your whole library to the cloud, or pull it back on another device.
          </Text>
          <View style={styles.row}>
            <Pressable
              testID="sync-push"
              accessibilityRole="button"
              disabled={busy}
              style={[styles.button, styles.flex1, busy && styles.buttonDisabled]}
              onPress={handlePush}
            >
              <Text style={styles.buttonText}>Push to cloud</Text>
            </Pressable>
            <Pressable
              testID="sync-pull"
              accessibilityRole="button"
              disabled={busy}
              style={[styles.button, styles.secondary, styles.flex1, busy && styles.buttonDisabled]}
              onPress={handlePull}
            >
              <Text style={styles.secondaryText}>Pull from cloud</Text>
            </Pressable>
          </View>
          {syncStatus ? (
            <Text testID="sync-status" style={styles.status}>
              {syncStatus}
            </Text>
          ) : null}
          <Pressable testID="sync-delete" accessibilityRole="button" disabled={busy} style={styles.deleteLink} onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete cloud data</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="auth-email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="auth-password"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={theme.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Pressable testID="auth-signin" accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.buttonDisabled]} onPress={handleSignIn}>
            <Text style={styles.buttonText}>Sign in</Text>
          </Pressable>
          <Pressable testID="auth-signup" accessibilityRole="button" disabled={busy} style={[styles.button, styles.secondary, busy && styles.buttonDisabled]} onPress={handleSignUp}>
            <Text style={styles.secondaryText}>Create account</Text>
          </Pressable>
        </View>
      )}

      {error ? (
        <Text testID="auth-error" style={styles.errorText}>
          {error}
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
    offline: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: theme.ink2 },
    block: { gap: 10 },
    label: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.ink },
    email: { fontFamily: fonts.displaySemibold, fontSize: 18, color: theme.accent },
    input: {
      backgroundColor: theme.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.ink,
      fontSize: 16,
      fontFamily: fonts.body,
    },
    button: { backgroundColor: theme.goldFill, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    secondary: { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line2 },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.onAccent },
    secondaryText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.ink },
    errorText: { fontFamily: fonts.body, fontSize: 14, color: theme.bad },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.line, marginVertical: 8 },
    row: { flexDirection: 'row', gap: 10 },
    flex1: { flex: 1 },
    status: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.accent },
    deleteLink: { alignSelf: 'flex-start', paddingVertical: 6 },
    deleteText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.bad },
  });
}
