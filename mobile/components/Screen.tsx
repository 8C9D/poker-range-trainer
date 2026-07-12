import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/colors';

interface ScreenProps {
  children: ReactNode;
  /** Fill color: the app background (default) or a raised surface. */
  fill?: 'bg' | 'surface';
  style?: StyleProp<ViewStyle>;
}

/**
 * Themed Coach screen container: fills with the active background and pads the top by
 * the device safe-area inset (the bottom tab bar handles the bottom inset). Screens
 * compose their own header + scroll/list content inside. Light/dark follows useTheme().
 */
export function Screen({ children, fill = 'bg', style }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: fill === 'surface' ? theme.surface : theme.bg,
          paddingTop: insets.top,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
