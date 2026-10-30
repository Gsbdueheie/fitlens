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
  const { profile, measurements, deleteMeasurement } = useApp();

  const [active, setActive] = useState<MetricKey>('weightKg');

  const sorted = [...measurements].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );

  // 体重历史测量（升序），仅用于「趋势/历史」展示，不伪造记录。
  const weightMeasurements = measurements
    .filter((m) => m.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestWeightMeasurement = weightMeasurements[weightMeasurements.length - 1] ?? null;

  // 当前体重：优先个人资料（服务端 profile.weightKg），其次最新测量。
  const currentWeight = profile?.weightKg ?? latestWeightMeasurement?.weightKg ?? null;

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
        {sorted.length === 0 && currentWeight == null ? (
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
                const isWeight = m.key === 'weightKg';
                const { last, prev } = latestPair(measurements, m.key);
                const delta = last != null && prev != null ? last - prev : null;
                const color = m.key === 'weightKg' ? colors.primary : m.key === 'waistCm' ? colors.warning : colors.protein;

                let value = '—';
                let sub = '暂无数据';
                let has = false;
                if (isWeight) {
                  // 体重「当前值」优先用个人资料体重（服务端），其次最新测量。
                  has = currentWeight != null;
                  value = currentWeight != null ? formatWeight(currentWeight) : '—';
                  sub = currentWeight == null
                    ? '暂无数据'
                    : profile?.weightKg != null
                      ? '来自个人资料'
                      : delta != null
                        ? `${formatDelta(delta)} kg`
                        : '暂无变化';
                } else {
                  has = last != null;
                  value = last != null ? formatLength(last) : '—';
                  sub = delta != null ? `${formatDelta(delta)} ${m.unit}` : '暂无变化';
                }

                return (
                  <View key={m.key} style={styles.tileCell}>
                    <StatTile
                      label={m.label}
                      value={value}
                      sub={sub}
                      color={has ? color : colors.textMuted}
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
            {sorted.length === 0 ? (
              <Card>
                <SectionTitle title="历史记录" style={styles.cardTitle} />
                <EmptyState
                  icon="body-outline"
                  title="还没有测量记录"
                  description="个人资料中的体重已作为当前体重展示；记录测量后可查看历史趋势"
                  actionLabel="记录测量"
                  onAction={() => router.push('/body-edit')}
                />
              </Card>
            ) : (
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
            )}

            <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
              当前体重来自个人资料（服务端）；历史趋势来自测量记录。趋势数据仅供日常记录参考，不构成医疗诊断或减重建议。
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
