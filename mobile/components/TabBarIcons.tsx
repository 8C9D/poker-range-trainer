import { View } from 'react-native';
import type { ColorValue } from 'react-native';

// View-drawn tab-bar glyphs (react-native-svg is not a dependency). Each mirrors the
// web AppShell line icon: Today = calendar, Library = 2x2 grid, Progress = bars,
// Account = person. Color + size come from react-navigation's tabBarIcon callback.
interface IconProps {
  color: ColorValue;
  size: number;
}

export function TodayIcon({ color, size }: IconProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: color,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: color }} />
      <View
        style={{
          width: size * 0.26,
          height: size * 0.26,
          borderRadius: size * 0.13,
          backgroundColor: color,
          marginTop: 3,
        }}
      />
    </View>
  );
}

export function LibraryIcon({ color, size }: IconProps) {
  const cell = (size - 3) / 2;
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: cell, height: cell, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

export function ProgressIcon({ color, size }: IconProps) {
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {[0.45, 0.75, 1].map((h, i) => (
        <View key={i} style={{ flex: 1, height: size * h, borderRadius: 1.5, backgroundColor: color }} />
      ))}
    </View>
  );
}

export function AccountIcon({ color, size }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-start' }}>
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size * 0.21,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.78,
          height: size * 0.46,
          borderTopLeftRadius: size * 0.39,
          borderTopRightRadius: size * 0.39,
          backgroundColor: color,
          marginTop: 2,
        }}
      />
    </View>
  );
}
