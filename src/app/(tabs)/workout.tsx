import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, Screen } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { confirmDialog } from '@/lib/confirm';
import { addDays, dateLabel, todayISO } from '@/lib/date';
import { formatKcal } from '@/lib/format';
import { MOOD_LABEL } from '@/lib/types';

export default function WorkoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { workouts, deleteWorkout } = useApp();

  const today = todayISO();
  const sorted = [...workouts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );

  const week = workouts.filter((w) => w.date >= addDays(today, -6));
  const weekCount = week.length;
  const weekBurn = week.reduce((s, w) => s + (w.caloriesBurned ?? 0), 0);

  return (
    <Screen>
      <View style={styles.stack}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>训练打卡</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            近 7 天 {weekCount} 次 · 消耗 {formatKcal(weekBurn)}
          </Text>
        </View>

        <Button title="新增训练" icon="add" onPress={() => router.push('/workout-edit')} />

        {sorted.length === 0 ? (
          <Card>
            <EmptyState
              icon="barbell-outline"
              title="还没有训练记录"
              description="完成训练后打卡，记录类型、时长与消耗"
              actionLabel="新增训练"
              onAction={() => router.push('/workout-edit')}
            />
          </Card>
        ) : (
          sorted.map((w) => (
            <Card key={w.id} style={styles.card}>
              <Pressable
                onPress={() => router.push({ pathname: '/workout-edit', params: { editId: w.id } })}
                accessibilityRole="button"
                accessibilityLabel={`编辑 ${w.type} 训练`}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="barbell" size={18} color={colors.primaryDeep} />
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.type, { color: colors.text }]}>{w.type}</Text>
                    {w.isSample ? <Badge label="示例" color={colors.textMuted} /> : null}
                  </View>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {dateLabel(w.date)} · {w.durationMin} 分钟
                    {w.caloriesBurned ? ` · ${formatKcal(w.caloriesBurned)}` : ''}
                    {w.mood ? ` · ${MOOD_LABEL[w.mood]}` : ''}
                  </Text>
                  {w.note ? (
                    <Text style={[styles.note, { color: colors.textMuted }]} numberOfLines={2}>
                      {w.note}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`删除 ${w.type} 训练`}
                  onPress={() => confirmDialog('删除记录', `确定删除「${w.type}」这条训练吗？`, () => deleteWorkout(w.id))}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </Pressable>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '800' },
  sub: { fontSize: fontSize.sm, marginTop: 2 },
  card: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  type: { fontSize: fontSize.md, fontWeight: '600' },
  meta: { fontSize: fontSize.xs },
  note: { fontSize: fontSize.xs, lineHeight: 17 },
});
