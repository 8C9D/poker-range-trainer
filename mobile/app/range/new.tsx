import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';

import { RangeEditor } from '../../components/RangeEditor';
import { Screen } from '../../components/Screen';
import { createRangeId } from '../../platform/createRangeId';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

/**
 * New-range editor: a fresh id is minted once, the shared `RangeEditor` live-saves the draft
 * under it as you build, and "Done" opens the new range's page. The Coach IA entry for creating
 * a range (Library's "New range" button).
 */
export default function NewRangeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [id] = useState(() => createRangeId());

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <Link href="/library" asChild>
          <Pressable hitSlop={8}>
            <Text style={[styles.back, { color: theme.accentStrong }]}>← Library</Text>
          </Pressable>
        </Link>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>New range</Text>
        <Pressable
          testID="new-range-done"
          onPress={() => router.replace({ pathname: '/range/[id]', params: { id } })}
          style={[styles.doneBtn, { backgroundColor: theme.goldFill }]}
        >
          <Text style={[styles.doneText, { color: theme.onAccent }]}>Done</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        <RangeEditor id={id} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  doneBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  doneText: { fontFamily: fonts.bodySemibold, fontSize: 14 },
});
