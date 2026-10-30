import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MacroBar, RingProgress, TrendChart, WeekBars } from '@/components/charts';
import { Button, Card, Screen, SectionTitle, StatTile, workoutIcon } from '@/components/ui';
import { fontSize, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { dateLabel, recentDays, shortDate, todayISO, weekdayLabel } from '@/lib/date';
import { formatDelta, formatInt, formatKcal, formatKcalCompact, formatWeight, KCAL_UNIT_NOTE } from '@/lib/format';
import { computeDailySummary, resolveTarget } from '@/lib/nutrition';
import { GOAL_LABEL, MOOD_LABEL } from '@/lib/types';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, workouts, foods, measurements, manualBurns } = useApp();

  const today = todayISO();
  const goal = profile?.goal ?? 'lose';
  const target = resolveTarget(goal, profile?.targetKcal ?? null);
  const summary = computeDailySummary(today, foods, workouts, manualBurns, target);

  const todayWorkouts = workouts
    .filter((w) => w.date === today)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const hasSample =
    workouts.some((w) => w.isSample) ||
    foods.some((f) => f.isSample) ||
    measurements.some((m) => m.isSample) ||
    manualBurns.some((b) => b.isSample);

  const days7 = recentDays(7);
  const burn7 = days7.map((d) => {
    const w = workouts.filter((x) => x.date === d).reduce((s, x) => s + (x.caloriesBurned ?? 0), 0);
    const m = manualBurns.filter((x) => x.date === d).reduce((s, x) => s + x.calories, 0);
    return { label: weekdayLabel(d).slice(1), value: Math.round(w + m) };
  });

  const weightSorted = measurements
    .filter((m) => m.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weightPoints = weightSorted.slice(-8).map((m) => ({ x: shortDate(m.date), y: m.weightKg as number }));
  const latestWeight = weightSorted[weightSorted.length - 1] ?? null;
  const prevWeight = weightSorted[weightSorted.length - 2] ?? null;
  const weightDelta = latestWeight && prevWeight ? latestWeight.weightKg! - prevWeight.weightKg! : null;

  return (
    <Screen>
      <View style={styles.stack}>
          <View style={styles.greeting}>
            <View style={styles.greetingText}>
              <Text style={[styles.hello, { color: colors.textSecondary }]}>
                {dateLabel(today)} · {GOAL_LABEL[goal]}
              </Text>
              <Text style={[styles.name, { color: colors.text }]}>
                {profile?.nickname ?? 'FitLens 用户'}
              </Text>
            </View>
            <View style={[styles.goalPill, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.goalPillText, { color: colors.primaryDeep }]}>
                目标 {formatKcal(target)}
              </Text>
            </View>
          </View>

          {hasSample ? (
            <View style={[styles.sampleBanner, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.sampleBannerText, { color: colors.textSecondary }]}>
                当前含预置示例数据（已标「示例」），仅用于演示，不代表真实记录。
              </Text>
            </View>
          ) : null}

          {/* 今日总览 */}
          <Card>
            <View style={styles.ringWrap}>
              <RingProgress
                value={summary.remaining > 0 ? summary.remaining : 0}
                max={summary.target + summary.burn}
                color={summary.remaining >= 0 ? colors.primary : colors.danger}
                label={formatInt(summary.remaining)}
                sublabel={summary.remaining >= 0 ? '剩余 · 卡' : '已超出 · 卡'}
              />
            </View>

            <View style={styles.tileRow}>
              <View style={styles.tileCell}>
                <StatTile label="今日摄入" value={formatKcal(summary.intake)} icon="restaurant-outline" color={colors.text} />
              </View>
              <View style={styles.tileCell}>
                <StatTile label="运动消耗" value={formatKcal(summary.burn)} icon="flame-outline" color={colors.warning} />
              </View>
              <View style={styles.tileCell}>
                <StatTile label="目标" value={formatKcal(summary.target)} icon="flag-outline" color={colors.textSecondary} />
              </View>
            </View>

            <View style={styles.macroSection}>
              <Text style={[styles.macroTitle, { color: colors.textSecondary }]}>
                今日营养（蛋白质 / 碳水 / 脂肪）
              </Text>
              <MacroBar
                protein={summary.protein}
                carbs={summary.carbs}
                fat={summary.fat}
                colors={{ protein: colors.protein, carbs: colors.carbs, fat: colors.fat }}
              />
            </View>

            <Text style={[styles.calcNote, { color: colors.textMuted }]}>
              口径：剩余 = 目标 + 运动消耗 − 摄入；运动消耗仅计主动运动，不含基础代谢。{KCAL_UNIT_NOTE}
            </Text>
          </Card>

          {/* 快捷操作 */}
          <View style={styles.actions}>
            <View style={styles.actionCell}>
              <Button
                title="拍照记一餐"
                icon="camera-outline"
                onPress={() => router.push('/food-recognize')}
              />
            </View>
            <View style={styles.actionCell}>
              <Button
                title="去打卡"
                icon="barbell-outline"
                variant="secondary"
                onPress={() => router.push('/workout-edit')}
              />
            </View>
          </View>

          {/* 今日训练 */}
          <Card>
            <SectionTitle title="今日训练" style={styles.cardTitle} />
            {todayWorkouts.length === 0 ? (
              <View style={styles.restRow}>
                <Ionicons name="barbell-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.restText, { color: colors.textSecondary }]}>今日还未训练</Text>
                <Button title="打卡" variant="ghost" icon="add" fullWidth={false} onPress={() => router.push('/workout-edit')} />
              </View>
            ) : (
              todayWorkouts.map((w) => (
                <View key={w.id} style={styles.workoutItem}>
                  <View style={[styles.workoutIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name={workoutIcon(w.type)} size={18} color={colors.primaryDeep} />
                  </View>
                  <View style={styles.workoutBody}>
                    <Text style={[styles.workoutType, { color: colors.text }]}>{w.type}</Text>
                    <Text style={[styles.workoutMeta, { color: colors.textSecondary }]}>
                      {w.durationMin} 分钟{w.caloriesBurned ? ` · ${formatKcal(w.caloriesBurned)}` : ''}
                      {w.mood ? ` · ${MOOD_LABEL[w.mood]}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          {/* 近 7 天运动消耗 */}
          <Card>
            <SectionTitle title="近 7 天运动消耗" style={styles.cardTitle} />
            <WeekBars data={burn7} color={colors.warning} valueLabel={formatKcalCompact} />
          </Card>

          {/* 体重趋势 */}
          <Card>
            <SectionTitle
              title="体重趋势"
              style={styles.cardTitle}
              right={
                latestWeight ? (
                  <View style={styles.weightRight}>
                    <Text style={[styles.weightNow, { color: colors.text }]}>{formatWeight(latestWeight.weightKg!)}</Text>
                    {weightDelta != null ? (
                      <Text
                        style={[
                          styles.weightDelta,
                          { color: weightDelta <= 0 ? colors.primary : colors.danger },
                        ]}
                      >
                        {formatDelta(weightDelta)} kg
                      </Text>
                    ) : null}
                  </View>
                ) : undefined
              }
            />
            {weightPoints.length >= 2 ? (
              <TrendChart data={weightPoints} color={colors.primary} unit="kg" />
            ) : (
              <View style={styles.restRow}>
                <Text style={[styles.restText, { color: colors.textSecondary }]}>
                  记录至少两条体重数据后显示趋势
                </Text>
                <Button title="去记录" variant="ghost" icon="add" fullWidth={false} onPress={() => router.push('/body-edit')} />
              </View>
            )}
          </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  greeting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingText: { gap: 2 },
  hello: { fontSize: fontSize.sm },
  name: { fontSize: fontSize.xl, fontWeight: '800' },
  goalPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  goalPillText: { fontSize: fontSize.xs, fontWeight: '700' },
  sampleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
  },
  sampleBannerText: { flex: 1, fontSize: fontSize.xs, lineHeight: 17 },
  ringWrap: { alignItems: 'center', marginBottom: spacing.lg },
  tileRow: { flexDirection: 'row', gap: spacing.md },
  tileCell: { flex: 1 },
  macroSection: { marginTop: spacing.lg, gap: spacing.sm },
  macroTitle: { fontSize: fontSize.sm, fontWeight: '600' },
  calcNote: { fontSize: fontSize.xs, lineHeight: 17, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionCell: { flex: 1 },
  cardTitle: { marginTop: 0 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  restText: { flex: 1, fontSize: fontSize.md, color: '#888' },
  workoutItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  workoutIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutBody: { flex: 1, gap: 2 },
  workoutType: { fontSize: fontSize.md, fontWeight: '600' },
  workoutMeta: { fontSize: fontSize.xs },
  weightRight: { alignItems: 'flex-end', gap: 2 },
  weightNow: { fontSize: fontSize.md, fontWeight: '700' },
  weightDelta: { fontSize: fontSize.sm, fontWeight: '600' },
});
