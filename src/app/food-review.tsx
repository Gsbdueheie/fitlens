import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Chip, Field, Screen } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { todayISO } from '@/lib/date';
import { formatPercent } from '@/lib/format';
import { scalePer100, type Per100g } from '@/lib/nutrition';
import { MEAL_LABEL, type FoodRecord, type MealType } from '@/lib/types';
import { nowISO, round, uid } from '@/lib/util';
import { clearDraft, getDraft } from '@/services/ai/draft';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function derivePer100(r: FoodRecord): Per100g {
  const a = r.amountG > 0 ? r.amountG : 100;
  return {
    calories: round((r.calories / a) * 100),
    protein: round((r.protein / a) * 100, 1),
    carbs: round((r.carbs / a) * 100, 1),
    fat: round((r.fat / a) * 100, 1),
  };
}

export default function FoodReviewScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { colors } = useTheme();
  const { foods, saveFood } = useApp();

  const existing = editId ? foods.find((f) => f.id === editId) : undefined;
  const [draft] = useState(() => getDraft());
  const rec = draft?.result.items[0];

  const isEdit = !!existing;
  const isRecognize = !!draft && !isEdit;
  const title = isEdit ? '编辑饮食记录' : isRecognize ? '确认识别结果' : '手动记录';

  const per100: Per100g | null = existing ? derivePer100(existing) : rec ? rec.per100 : null;
  const initAmount = existing?.amountG ?? rec?.amountG ?? 200;
  const initNutri = existing
    ? { calories: existing.calories, protein: existing.protein, carbs: existing.carbs, fat: existing.fat }
    : rec
      ? scalePer100(rec.per100, rec.amountG)
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const [mealType, setMealType] = useState<MealType>(existing?.mealType ?? 'lunch');
  const [name, setName] = useState(existing?.foodName ?? rec?.foodName ?? '');
  const [amount, setAmount] = useState(String(initAmount));
  const [calories, setCalories] = useState(String(initNutri.calories));
  const [protein, setProtein] = useState(String(initNutri.protein));
  const [carbs, setCarbs] = useState(String(initNutri.carbs));
  const [fat, setFat] = useState(String(initNutri.fat));
  const [nameError, setNameError] = useState<string | null>(null);
  const [calError, setCalError] = useState<string | null>(null);

  const isMock = existing?.isMock ?? draft?.result.isMock ?? false;
  const confidence = existing?.confidence ?? rec?.confidence ?? null;
  const uncertaintyNote = existing?.uncertaintyNote ?? draft?.result.uncertaintyNote ?? null;
  const imageUri = existing?.imageUri ?? draft?.imageUri ?? null;

  function handleAmount(t: string) {
    setAmount(t);
    if (per100) {
      const a = parseFloat(t);
      if (!isNaN(a) && a > 0) {
        const s = scalePer100(per100, a);
        setCalories(String(s.calories));
        setProtein(String(s.protein));
        setCarbs(String(s.carbs));
        setFat(String(s.fat));
      }
    }
  }

  function save() {
    const n = name.trim();
    const cal = parseFloat(calories);
    const amt = parseFloat(amount);
    let ok = true;
    if (!n) {
      setNameError('请输入食物名称');
      ok = false;
    } else {
      setNameError(null);
    }
    if (isNaN(cal) || cal < 0) {
      setCalError('请输入有效热量（≥ 0）');
      ok = false;
    } else {
      setCalError(null);
    }
    if (!ok) return;

    const record: FoodRecord = {
      id: existing?.id ?? uid(),
      date: existing?.date ?? todayISO(),
      mealType,
      foodName: n,
      amountG: !isNaN(amt) && amt > 0 ? round(amt) : 0,
      calories: round(cal),
      protein: round(parseFloat(protein) || 0, 1),
      carbs: round(parseFloat(carbs) || 0, 1),
      fat: round(parseFloat(fat) || 0, 1),
      source: existing?.source ?? (draft ? 'ai' : 'manual'),
      isMock,
      confidence,
      uncertaintyNote,
      imageUri,
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    };

    void saveFood(record);
    clearDraft();
    router.back();
  }

  return (
    <Screen title={title} onBack={() => router.back()}>
      {isRecognize && rec ? (
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
            ) : null}
            <View style={styles.infoBody}>
              <View style={styles.badgeRow}>
                {isMock ? (
                  <Badge label="模拟识别" color={colors.warning} icon="flask-outline" />
                ) : (
                  <Badge label="AI 识别" color={colors.primary} icon="sparkles-outline" />
                )}
                {confidence != null ? (
                  <Badge label={`置信度 ${formatPercent(confidence)}`} color={colors.textMuted} />
                ) : null}
              </View>
              <Text style={[styles.uncertainty, { color: colors.textSecondary }]}>
                {uncertaintyNote}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {isEdit && existing?.isMock ? (
        <View style={styles.editMock}>
          <Badge label="模拟识别结果" color={colors.warning} icon="flask-outline" />
        </View>
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>餐次</Text>
      <View style={styles.mealRow}>
        {MEAL_ORDER.map((m) => (
          <Chip key={m} label={MEAL_LABEL[m]} selected={mealType === m} onPress={() => setMealType(m)} />
        ))}
      </View>

      <View style={styles.formGap}>
        <Field label="食物名称" value={name} onChangeText={setName} placeholder="例如：鸡胸肉沙拉" error={nameError} />
        <Field
          label="份量"
          value={amount}
          onChangeText={handleAmount}
          placeholder="克"
          keyboardType="decimal-pad"
          suffix="克"
        />
        <Field label="热量" value={calories} onChangeText={setCalories} placeholder="kcal" keyboardType="decimal-pad" suffix="卡" error={calError} />
        <View style={styles.macroRow}>
          <View style={styles.macroCol}>
            <Field label="蛋白质" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="g" />
          </View>
          <View style={styles.macroCol}>
            <Field label="碳水" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="g" />
          </View>
          <View style={styles.macroCol}>
            <Field label="脂肪" value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="g" />
          </View>
        </View>
      </View>

      {per100 ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          调整份量会按每 100g 营养值等比更新热量与营养素；你仍可手动修改任一数值。
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="保存记录" icon="checkmark" onPress={save} />
        <Button title="取消" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoCard: { marginBottom: spacing.lg },
  infoRow: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  infoBody: { flex: 1, gap: spacing.sm },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  uncertainty: { fontSize: fontSize.xs, lineHeight: 17 },
  editMock: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.sm },
  mealRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  formGap: { gap: 0 },
  macroRow: { flexDirection: 'row', gap: spacing.sm },
  macroCol: { flex: 1 },
  hint: { fontSize: fontSize.xs, lineHeight: 17, marginTop: -spacing.sm, marginBottom: spacing.lg },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
