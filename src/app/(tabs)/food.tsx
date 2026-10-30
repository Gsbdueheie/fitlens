import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, Screen } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { confirmDialog } from '@/lib/confirm';
import { addDays, dateLabel, todayISO } from '@/lib/date';
import { formatKcal, formatKcalCompact } from '@/lib/format';
import { computeDailySummary, resolveTarget } from '@/lib/nutrition';
import { MEAL_LABEL, type MealType } from '@/lib/types';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function FoodScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, foods, workouts, manualBurns, deleteFood } = useApp();

  const today = todayISO();
  const [date, setDate] = useState(today);

  const target = resolveTarget(profile?.goal ?? 'lose', profile?.targetKcal ?? null);
  const summary = computeDailySummary(date, foods, workouts, manualBurns, target);

  const dayFoods = foods
    .filter((f) => f.date === date)
    .sort(
      (a, b) =>
        MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  const grouped = MEAL_ORDER.map((m) => ({
    meal: m,
    items: dayFoods.filter((f) => f.mealType === m),
  })).filter((g) => g.items.length > 0);

  return (
    <Screen>
      <View style={styles.stack}>
        {/* 日期选择器 */}
        <View style={styles.dateRow}>
          <Pressable
            onPress={() => setDate(addDays(date, -1))}
            accessibilityRole="button"
            accessibilityLabel="前一天"
            style={({ pressed }) => [styles.dateBtn, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.dateCenter}>
            <Text style={[styles.dateLabel, { color: colors.text }]}>{dateLabel(date)}</Text>
            <Text style={[styles.dateSub, { color: colors.textSecondary }]}>
              摄入 {formatKcal(summary.intake)} · 蛋白 {summary.protein}g · 碳水 {summary.carbs}g · 脂肪 {summary.fat}g
            </Text>
          </View>
          <Pressable
            onPress={() => date < today && setDate(addDays(date, 1))}
            disabled={date >= today}
            accessibilityRole="button"
            accessibilityLabel="后一天"
            style={({ pressed }) => [
              styles.dateBtn,
              { borderColor: colors.border, backgroundColor: colors.surface, opacity: date >= today ? 0.3 : pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* 入口 */}
        <View style={styles.actions}>
          <View style={styles.actionCell}>
            <Button title="拍照识别" icon="camera-outline" onPress={() => router.push('/food-recognize')} />
          </View>
          <View style={styles.actionCell}>
            <Button title="手动记录" icon="create-outline" variant="secondary" onPress={() => router.push('/food-review')} />
          </View>
        </View>

        {/* 记录列表 */}
        {grouped.length === 0 ? (
          <Card>
            <EmptyState
              icon="restaurant-outline"
              title="这一天还没有饮食记录"
              description="拍照识别或手动记录一餐，开始积累每日营养数据"
              actionLabel="拍照识别"
              onAction={() => router.push('/food-recognize')}
            />
          </Card>
        ) : (
          grouped.map((g) => (
            <View key={g.meal} style={styles.mealGroup}>
              <Text style={[styles.mealHeader, { color: colors.textSecondary }]}>{MEAL_LABEL[g.meal]}</Text>
              <Card style={styles.mealCard}>
                {g.items.map((f, i) => (
                  <View key={f.id}>
                    {i > 0 ? <View style={[styles.sep, { backgroundColor: colors.border }]} /> : null}
                    <Pressable
                      onPress={() => router.push({ pathname: '/food-review', params: { editId: f.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`编辑 ${f.foodName}`}
                      style={({ pressed }) => [styles.foodRow, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <View style={styles.foodMain}>
                        <View style={styles.foodTitleRow}>
                          <Text style={[styles.foodName, { color: colors.text }]} numberOfLines={1}>
                            {f.foodName}
                          </Text>
                          {f.isSample ? <Badge label="示例" color={colors.textMuted} /> : null}
                          {f.isMock ? <Badge label="模拟" color={colors.warning} /> : null}
                          {!f.isMock && f.source === 'ai' ? <Badge label="AI" color={colors.primary} /> : null}
                        </View>
                        <Text style={[styles.foodMeta, { color: colors.textSecondary }]}>
                          {f.amountG > 0 ? `${f.amountG}g · ` : ''}
                          蛋白 {f.protein}g · 碳水 {f.carbs}g · 脂肪 {f.fat}g
                        </Text>
                      </View>
                      <View style={styles.foodRight}>
                        <Text style={[styles.foodKcal, { color: colors.text }]}>{formatKcalCompact(f.calories)}</Text>
                        <Pressable
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`删除 ${f.foodName}`}
                          onPress={() =>
                            confirmDialog('删除记录', `确定删除「${f.foodName}」吗？`, () => deleteFood(f.id))
                          }
                          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: { flex: 1, alignItems: 'center', gap: 2 },
  dateLabel: { fontSize: fontSize.lg, fontWeight: '700' },
  dateSub: { fontSize: fontSize.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionCell: { flex: 1 },
  mealGroup: { gap: spacing.sm },
  mealHeader: { fontSize: fontSize.sm, fontWeight: '700' },
  mealCard: { paddingVertical: spacing.xs },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md },
  foodMain: { flex: 1, gap: 4 },
  foodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  foodName: { fontSize: fontSize.md, fontWeight: '600', flexShrink: 1 },
  foodMeta: { fontSize: fontSize.xs },
  foodRight: { alignItems: 'flex-end', gap: spacing.sm },
  foodKcal: { fontSize: fontSize.md, fontWeight: '700' },
});
