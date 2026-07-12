import { Tabs } from 'expo-router';

import { AccountIcon, LibraryIcon, ProgressIcon, TodayIcon } from '../../components/TabBarIcons';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

// Coach bottom-tab shell: Today / Library / Progress / Account. Screens own their
// headers (headerShown: false), so the tab bar is the only chrome. Tinted with the
// active Coach palette (gold accent for the current tab, quiet ink for the rest).
export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.ink3,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color, size }) => <TodayIcon color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: 'Library', tabBarIcon: ({ color, size }) => <LibraryIcon color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <ProgressIcon color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color, size }) => <AccountIcon color={color} size={size} /> }}
      />
    </Tabs>
  );
}
