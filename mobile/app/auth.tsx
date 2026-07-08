import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getCurrentSession, onAuthChange, signIn, signOut, signUp } from '@core/cloud/auth';
import { pullBackup, pushBackup } from '@core/cloud/backupRepo';
import { buildBackup, restoreBackup } from '@core/storage/backup';

import { getMobileSupabaseClient } from '../platform/supabaseClient';
import { colors } from '../theme/colors';

/**
 * Account screen (M7): sign up / in / out over the reused `@core/cloud/auth`, using the native
 * Supabase client from `getMobileSupabaseClient`. Local-first: when cloud is unconfigured the
 * client is null and the screen shows an offline message with no form. All auth logic lives in
 * `@core` — this screen only resolves the client, gathers credentials, and renders session state.
 */
export default function AuthScreen() {
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
    void run(async () => {
      setSession(await signIn(email.trim(), password, client));
    });
  }, [client, email, password, run]);

  const handleSignUp = useCallback(() => {
    if (!client) return;
    void run(async () => {
      setSession(await signUp(email.trim(), password, client));
    });
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

  const handlePull = useCallback(() => {
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Account' }} />

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
          <Text style={styles.muted}>Push your whole library to the cloud, or pull it back on another device.</Text>
          <View style={styles.syncRow}>
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
            <Text testID="sync-status" style={styles.syncStatus}>
              {syncStatus}
            </Text>
          ) : null}
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
            placeholderTextColor={colors.text}
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
            placeholderTextColor={colors.text}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Pressable
            testID="auth-signin"
            accessibilityRole="button"
            disabled={busy}
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleSignIn}
          >
            <Text style={styles.buttonText}>Sign in</Text>
          </Pressable>
          <Pressable
            testID="auth-signup"
            accessibilityRole="button"
            disabled={busy}
            style={[styles.button, styles.secondary, busy && styles.buttonDisabled]}
            onPress={handleSignUp}
          >
            <Text style={styles.secondaryText}>Create account</Text>
          </Pressable>
        </View>
      )}

      {error ? (
        <Text testID="auth-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  muted: {
    color: colors.text,
    fontSize: 15,
    marginTop: 24,
    textAlign: 'center',
  },
  offline: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
  },
  block: {
    gap: 10,
  },
  label: {
    color: colors.textStrong,
    fontSize: 14,
    fontWeight: '600',
  },
  email: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textStrong,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  syncRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  syncStatus: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
