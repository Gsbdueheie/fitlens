import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TrendChart } from '@/components/charts';
import { Badge, Button, Card, Chip, EmptyState, Screen, SectionTitle, StatTile } from '@/components/ui';
import { fontSize, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { confirmDialog } from '@/lib/confirm';
import { dateLabel, shortDate } from '@/lib/date';
import { formatDelta, formatLength, formatWeight } from '@/lib/format';
import type { BodyMeasurement } from '@/lib/types';

type MetricKey = 'weightKg' | 'waistCm' | 'hipCm';

const METRICS: { key: MetricKey; label: string; unit: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'weightKg', label: '体重', unit: 'kg', icon: 'scale-outline' },
  { key: 'waistCm', label: '腰围', unit: 'cm', icon: 'resize-outline' },
  { key: 'hipCm', label: '臀围', unit: 'cm', icon: 'body-outline' },
];

function latestPair(arr: BodyMeasurement[], key: MetricKey) {
  const s = arr.filter((m) => m[key] != null).sort((a, b) => a.date.localeCompare(b.date));
  const last = s[s.length - 1];
  const prev = s[s.length - 2];
  return { last: last?.[key] ?? null, prev: prev?.[key] ?? null };
}

export default function BodyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { measurements, deleteMeasurement } = useApp();

  const [active, setActive] = useState<MetricKey>('weightKg');

  const sorted = [...measurements].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );

  const activeMetric = METRICS.find((m) => m.key === active)!;
  const trendData = measurements
    .filter((m) => m[active] != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ x: shortDate(m.date), y: m[active] as number }));

  const trendColor =
    active === 'weightKg' ? colors.primary : active === 'waistCm' ? colors.warning : colors.protein;

  return (
    <Screen>
      <View style={styles.stack}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>身体数据</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>记录体重、腰围、臀围并查看变化</Text>
        </View>

        <Button title="记录测量" icon="add" onPress={() => router.push('/body-edit')} />

        {/* 最近一次 + 变化 */}
        {sorted.length === 0 ? (
          <Card>
            <EmptyState
              icon="body-outline"
              title="还没有身体数据"
              description="记录体重、腰围、臀围，持续观察身体变化趋势"
              actionLabel="记录测量"
              onAction={() => router.push('/body-edit')}
            />
          </Card>
        ) : (
          <>
            <View style={styles.tileRow}>
              {METRICS.map((m) => {
                const { last, prev } = latestPair(measurements, m.key);
                const delta = last != null && prev != null ? last - prev : null;
                const color = m.key === 'weightKg' ? colors.primary : m.key === 'waistCm' ? colors.warning : colors.protein;
                return (
                  <View key={m.key} style={styles.tileCell}>
                    <StatTile
                      label={m.label}
                      value={last != null ? (m.key === 'weightKg' ? formatWeight(last) : formatLength(last)) : '—'}
                      sub={delta != null ? `${formatDelta(delta)} ${m.unit}` : '暂无变化'}
                      color={last != null ? color : colors.textMuted}
                      icon={m.icon}
                    />
                  </View>
                );
              })}
            </View>

            {/* 趋势 */}
            <Card>
              <SectionTitle title="趋势" style={styles.cardTitle} />
              <View style={styles.chips}>
                {METRICS.map((m) => (
                  <Chip key={m.key} label={m.label} selected={active === m.key} onPress={() => setActive(m.key)} />
                ))}
              </View>
              {trendData.length >= 2 ? (
                <TrendChart data={trendData} color={trendColor} unit={activeMetric.unit} />
              ) : (
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  至少两条{activeMetric.label}记录后显示趋势
                </Text>
              )}
            </Card>

            {/* 历史记录 */}
            <Card>
              <SectionTitle title="历史记录" style={styles.cardTitle} />
              {sorted.map((m, i) => (
                <View key={m.id}>
                  {i > 0 ? <View style={[styles.sep, { backgroundColor: colors.border }]} /> : null}
                  <Pressable
                    onPress={() => router.push({ pathname: '/body-edit', params: { editId: m.id } })}
                    accessibilityRole="button"
                    accessibilityLabel={`编辑 ${dateLabel(m.date)} 的身体数据`}
                    style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <View style={styles.rowBody}>
                      <View style={styles.rowTitle}>
                        <Text style={[styles.rowDate, { color: colors.text }]}>{dateLabel(m.date)}</Text>
                        {m.isSample ? <Badge label="示例" color={colors.textMuted} /> : null}
                      </View>
                      <Text style={[styles.rowVals, { color: colors.textSecondary }]}>
                        {[
                          m.weightKg != null ? formatWeight(m.weightKg) : null,
                          m.waistCm != null ? `腰围 ${formatLength(m.waistCm)}` : null,
                          m.hipCm != null ? `臀围 ${formatLength(m.hipCm)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`删除 ${dateLabel(m.date)} 的记录`}
                      onPress={() =>
                        confirmDialog('删除记录', `确定删除 ${dateLabel(m.date)} 的测量记录吗？`, () => deleteMeasurement(m.id))
                      }
                      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  </Pressable>
                </View>
              ))}
            </Card>

            <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
              趋势数据仅供日常记录参考，不构成医疗诊断或减重建议。
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '800' },
  sub: { fontSize: fontSize.sm, marginTop: 2 },
  tileRow: { flexDirection: 'row', gap: spacing.md },
  tileCell: { flex: 1 },
  cardTitle: { marginTop: 0 },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  hint: { fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.xl },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowDate: { fontSize: fontSize.md, fontWeight: '600' },
  rowVals: { fontSize: fontSize.xs },
  disclaimer: { fontSize: fontSize.xs, lineHeight: 17 },
});
