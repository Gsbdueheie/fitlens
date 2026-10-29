import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontSize, radius, spacing, useTheme } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; label: string; icon: IoniconName; active: IoniconName }[] = [
  { name: 'index', label: '首页', icon: 'home-outline', active: 'home' },
  { name: 'food', label: '饮食', icon: 'restaurant-outline', active: 'restaurant' },
  { name: 'workout', label: '打卡', icon: 'barbell-outline', active: 'barbell' },
  { name: 'body', label: '身体', icon: 'body-outline', active: 'body' },
  { name: 'profile', label: '我的', icon: 'person-outline', active: 'person' },
];

function tabHref(name: string): string {
  return name === 'index' ? '/' : `/${name}`;
}

interface TabBarProps {
  state: { index: number; routes: { name: string; key: string }[] };
}

export function CustomTabBar({ state }: TabBarProps) {
  const { colors } = useTheme();
  const activeName = state.routes[state.index]?.name;
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webNav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.webNavInner}>
          <Text style={[styles.brand, { color: colors.primary }]}>FitLens</Text>
          <View style={styles.webLinks}>
            {TABS.map((t) => {
              const active = activeName === t.name;
              return (
                <Pressable
                  key={t.name}
                  onPress={() => router.navigate(tabHref(t.name))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.webLink,
                    { opacity: pressed ? 0.6 : 1 },
                    active && { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Text style={[styles.webLinkText, { color: active ? colors.primary : colors.textSecondary }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bottomBar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {TABS.map((t) => {
        const active = activeName === t.name;
        const color = active ? colors.primary : colors.tabInactive;
        return (
          <Pressable
            key={t.name}
            onPress={() => router.navigate(tabHref(t.name))}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name={active ? t.active : t.icon} size={22} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  webNav: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webNavInner: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brand: { fontSize: fontSize.xl, fontWeight: '800', letterSpacing: -0.5 },
  webLinks: { flexDirection: 'row', gap: spacing.xs },
  webLink: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill },
  webLinkText: { fontSize: fontSize.sm, fontWeight: '600' },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  tabLabel: { fontSize: fontSize.xs, fontWeight: '500' },
});
