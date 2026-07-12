import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

// Today tab — placeholder shell for the Coach routing skeleton. The full "what's due
// today" screen (streak, Start review, due list, week tiles) lands in a later slice.
export default function TodayScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.ink }]}>Today</Text>
        <Text style={[styles.subtitle, { color: theme.ink2 }]}>
          Your review queue will live here.
        </Text>
        <Link href="/library" asChild>
          <Pressable style={[styles.cta, { backgroundColor: theme.goldFill }]}>
            <Text style={[styles.ctaText, { color: theme.onAccent }]}>Browse library</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 34 },
  subtitle: { fontFamily: fonts.body, fontSize: 16 },
  cta: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  ctaText: { fontFamily: fonts.bodySemibold, fontSize: 16 },
});
