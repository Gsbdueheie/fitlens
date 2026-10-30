import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Field, Screen } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { addDays, dateLabel, todayISO } from '@/lib/date';
import { MOOD_LABEL, WORKOUT_TYPES, type Mood, type WorkoutRecord } from '@/lib/types';
import { nowISO, round, uid } from '@/lib/util';
import { showAlert } from '@/lib/confirm';
import { ApiError } from '@/services/api';

const MOODS: (Mood | null)[] = [null, 'great', 'ok', 'tired'];

export default function WorkoutEditScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { colors } = useTheme();
  const { workouts, saveWorkout } = useApp();

  const existing = editId ? workouts.find((w) => w.id === editId) : undefined;
  const today = todayISO();

  const [date, setDate] = useState(existing?.date ?? today);
  const [type, setType] = useState(existing?.type ?? '力量训练');
  const [duration, setDuration] = useState(existing ? String(existing.durationMin) : '');
  const [calories, setCalories] = useState(existing?.caloriesBurned != null ? String(existing.caloriesBurned) : '');
  const [mood, setMood] = useState<Mood>(existing?.mood ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<{ duration?: string; calories?: string }>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const dur = parseFloat(duration);
    const cal = calories.trim() === '' ? null : parseFloat(calories);
    const next: { duration?: string; calories?: string } = {};
    if (isNaN(dur) || dur <= 0) next.duration = '请输入有效的训练时长（分钟）';
    if (cal != null && (isNaN(cal) || cal < 0)) next.calories = '消耗热量需 ≥ 0';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const record: WorkoutRecord = {
      id: existing?.id ?? uid(),
      date,
      type,
      durationMin: round(dur),
      caloriesBurned: cal != null ? round(cal) : null,
      note: note.trim(),
      mood,
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    };

    setSaving(true);
    try {
      await saveWorkout(record);
      router.back();
    } catch (e) {
      const detail = e instanceof ApiError ? e.message : '请检查网络后重试';
      // 本机记录已乐观更新；同步服务端失败时明确提示，不静默。
      showAlert('保存失败', `未能同步到服务器：${detail}（记录已保留在本机，可重试）`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title={existing ? '编辑训练' : '新增训练'} onBack={() => router.back()}>
      <View style={styles.stack}>
        {/* 日期 */}
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

        <Text style={[styles.label, { color: colors.textSecondary }]}>训练类型</Text>
        <View style={styles.chips}>
          {WORKOUT_TYPES.map((t) => (
            <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>

        <Field
          label="训练时长"
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/[^\d.]/g, ''))}
          placeholder="例如 45"
          keyboardType="decimal-pad"
          suffix="分钟"
          error={errors.duration}
        />

        <Field
          label="运动消耗（选填）"
          value={calories}
          onChangeText={(t) => setCalories(t.replace(/[^\d.]/g, ''))}
          placeholder="例如 300"
          keyboardType="decimal-pad"
          suffix="千卡"
          error={errors.calories}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>主观感受（选填）</Text>
        <View style={styles.chips}>
          {MOODS.map((m) => (
            <Chip
              key={String(m)}
              label={m == null ? '不填' : MOOD_LABEL[m]}
              selected={mood === m}
              onPress={() => setMood(m)}
            />
          ))}
        </View>

        <Field
          label="备注（选填）"
          value={note}
          onChangeText={setNote}
          placeholder="记录今天的感受或动作细节"
          multiline
        />

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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
