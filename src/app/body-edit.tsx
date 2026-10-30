import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { addDays, dateLabel, todayISO } from '@/lib/date';
import type { BodyMeasurement } from '@/lib/types';
import { nowISO, round, uid } from '@/lib/util';
import { ApiError } from '@/services/api';

export default function BodyEditScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { colors } = useTheme();
  const { measurements, saveMeasurement } = useApp();

  const existing = editId ? measurements.find((m) => m.id === editId) : undefined;
  const today = todayISO();

  const [date, setDate] = useState(existing?.date ?? today);
  const [weight, setWeight] = useState(existing?.weightKg != null ? String(existing.weightKg) : '');
  const [waist, setWaist] = useState(existing?.waistCm != null ? String(existing.waistCm) : '');
  const [hip, setHip] = useState(existing?.hipCm != null ? String(existing.hipCm) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const w = weight.trim() === '' ? null : parseFloat(weight);
    const wa = waist.trim() === '' ? null : parseFloat(waist);
    const h = hip.trim() === '' ? null : parseFloat(hip);

    if (w == null && wa == null && h == null) {
      setError('请至少填写一项身体数据');
      return;
    }
    for (const [label, v, min, max] of [
      ['体重', w, 20, 400],
      ['腰围', wa, 20, 300],
      ['臀围', h, 20, 300],
    ] as const) {
      if (v != null && (isNaN(v) || v < min || v > max)) {
        setError(`${label}数值需在 ${min}–${max} 之间`);
        return;
      }
    }

    const record: BodyMeasurement = {
      id: existing?.id ?? uid(),
      date,
      weightKg: w != null ? round(w, 1) : null,
      waistCm: wa != null ? round(wa, 1) : null,
      hipCm: h != null ? round(h, 1) : null,
      note: note.trim(),
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    };

    setSaving(true);
    setError(null);
    try {
      await saveMeasurement(record);
      router.back();
    } catch (e) {
      // 本地测量已保存；同步体重到个人资料失败时明确提示，不静默退回示例值。
      const detail = e instanceof ApiError ? e.message : '请检查网络后重试';
      setError(`测量已保存到本机，但同步体重到个人资料失败：${detail}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title={existing ? '编辑测量' : '记录测量'} onBack={() => router.back()}>
      <View style={styles.stack}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>日期</Text>
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

        <Field label="体重（选填）" value={weight} onChangeText={(t) => setWeight(t.replace(/[^\d.]/g, ''))} placeholder="例如 62.5" keyboardType="decimal-pad" suffix="kg" />
        <Field label="腰围（选填）" value={waist} onChangeText={(t) => setWaist(t.replace(/[^\d.]/g, ''))} placeholder="例如 70" keyboardType="decimal-pad" suffix="cm" />
        <Field label="臀围（选填）" value={hip} onChangeText={(t) => setHip(t.replace(/[^\d.]/g, ''))} placeholder="例如 93" keyboardType="decimal-pad" suffix="cm" />
        <Field label="备注（选填）" value={note} onChangeText={setNote} placeholder="例如：晨起空腹测量" multiline />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button title="保存" icon="checkmark" loading={saving} onPress={save} />
          <Button title="取消" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: fontSize.lg, fontWeight: '700' },
  error: { fontSize: fontSize.sm, marginTop: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
