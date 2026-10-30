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
import { api, ApiError } from '@/services/api';
import { clearDraft, getDraft } from '@/services/ai/draft';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const PORTION_REF =
  '份量参考：一碗米饭≈200g · 一个鸡蛋≈50g · 一掌心瘦肉≈100g · 一个苹果≈180g · 一杯牛奶≈250ml';

// 份量档位：以模型估算克数为基准，按比例换算（小/中/大）。
const PORTION_TIERS: { key: 'small' | 'medium' | 'large'; label: string; factor: number }[] = [
  { key: 'small', label: '偏少', factor: 0.7 },
  { key: 'medium', label: '适中', factor: 1 },
  { key: 'large', label: '偏多', factor: 1.3 },
];

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
  const { session, foods, saveFood } = useApp();

  const existing = editId ? foods.find((f) => f.id === editId) : undefined;
  const [draft] = useState(() => getDraft());
  const rec = draft?.response.foods[0];

  const isEdit = !!existing;
  const isRecognize = !!draft && !isEdit;
  const title = isEdit ? '编辑饮食记录' : isRecognize ? '确认识别结果' : '手动记录';

  const initPer100: Per100g | null = existing
    ? derivePer100(existing)
    : rec?.nutrition && rec.amount > 0
      ? {
          calories: round((rec.nutrition.calories / rec.amount) * 100),
          protein: round((rec.nutrition.protein / rec.amount) * 100, 1),
          carbs: round((rec.nutrition.carbs / rec.amount) * 100, 1),
          fat: round((rec.nutrition.fat / rec.amount) * 100, 1),
        }
      : null;

  const initAmount = existing?.amountG ?? rec?.amount ?? 200;
  const initNutri = existing
    ? { calories: existing.calories, protein: existing.protein, carbs: existing.carbs, fat: existing.fat }
    : rec?.nutrition
      ? { calories: rec.nutrition.calories, protein: rec.nutrition.protein, carbs: rec.nutrition.carbs, fat: rec.nutrition.fat }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const [mealType, setMealType] = useState<MealType>(existing?.mealType ?? 'lunch');
  const [name, setName] = useState(existing?.foodName ?? rec?.name ?? '');
  const [amount, setAmount] = useState(String(initAmount));
  const [calories, setCalories] = useState(String(initNutri.calories));
  const [protein, setProtein] = useState(String(initNutri.protein));
  const [carbs, setCarbs] = useState(String(initNutri.carbs));
  const [fat, setFat] = useState(String(initNutri.fat));
  const [per100, setPer100] = useState<Per100g | null>(initPer100);
  const [nutritionSource, setNutritionSource] = useState<string | null>(
    existing?.nutritionSource ?? rec?.nutrition?.source ?? null,
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [calError, setCalError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateMsg, setEstimateMsg] = useState<string | null>(null);

  const confidence = existing?.confidence ?? rec?.confidence ?? null;
  const uncertaintyNote = existing?.uncertaintyNote ?? draft?.response.uncertainty ?? null;
  const imageUri = existing?.imageUri ?? draft?.imageUri ?? null;
  const ingredients = rec?.ingredients ?? [];
  const portion = rec?.portion ?? '';
  const baseAmount = rec?.amount ?? 200;
  const [tier, setTier] = useState<'small' | 'medium' | 'large'>('medium');

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

  /** 选择份量档位：以模型估算克数为基准，按比例换算并联动营养素。 */
  function selectTier(factor: number, key: 'small' | 'medium' | 'large') {
    setTier(key);
    const v = Math.max(1, Math.round(baseAmount * factor));
    setAmount(String(v));
    if (per100) {
      const s = scalePer100(per100, v);
      setCalories(String(s.calories));
      setProtein(String(s.protein));
      setCarbs(String(s.carbs));
      setFat(String(s.fat));
    }
  }

  async function reestimate() {
    if (!session?.token) return;
    const a = parseFloat(amount);
    if (!name.trim() || isNaN(a) || a <= 0) {
      setEstimateMsg('请先填写食物名称和份量');
      return;
    }
    setEstimating(true);
    setEstimateMsg(null);
    try {
      const res = await api.nutrition(session.token, { name: name.trim(), amount: a });
      if (res.nutrition) {
        setCalories(String(res.nutrition.calories));
        setProtein(String(res.nutrition.protein));
        setCarbs(String(res.nutrition.carbs));
        setFat(String(res.nutrition.fat));
        setNutritionSource(res.nutrition.source);
        setPer100({
          calories: round((res.nutrition.calories / a) * 100),
          protein: round((res.nutrition.protein / a) * 100, 1),
          carbs: round((res.nutrition.carbs / a) * 100, 1),
          fat: round((res.nutrition.fat / a) * 100, 1),
        });
        setEstimateMsg('已按食物库重新估算');
      } else {
        setNutritionSource(null);
        setEstimateMsg('未查到该食物的营养数据，请手动填写热量与营养素');
      }
    } catch (e) {
      setEstimateMsg(e instanceof ApiError ? e.message : '估算失败');
    } finally {
      setEstimating(false);
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
      isMock: false,
      confidence,
      uncertaintyNote,
      nutritionSource,
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
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" /> : null}
            <View style={styles.infoBody}>
              <View style={styles.badgeRow}>
                <Badge label="AI 识别" color={colors.primary} icon="sparkles-outline" />
                {confidence != null ? (
                  <Badge label={`置信度 ${formatPercent(confidence)}`} color={colors.textMuted} />
                ) : null}
                {nutritionSource ? <Badge label="含营养估算" color={colors.success} /> : null}
              </View>
              <Text style={[styles.uncertainty, { color: colors.textSecondary }]}>{uncertaintyNote}</Text>
              {ingredients.length > 0 ? (
                <View style={styles.ingredients}>
                  {ingredients.map((ing, i) => (
                    <Chip key={i} label={ing} />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </Card>
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>餐次</Text>
      <View style={styles.mealRow}>
        {MEAL_ORDER.map((m) => (
          <Chip key={m} label={MEAL_LABEL[m]} selected={mealType === m} onPress={() => setMealType(m)} />
        ))}
      </View>

      <View style={styles.formGap}>
        <Field label="食物名称" value={name} onChangeText={setName} placeholder="例如：鸡胸肉沙拉" error={nameError} />
        <Field label="份量" value={amount} onChangeText={handleAmount} placeholder="克" keyboardType="decimal-pad" suffix="克" />
        {portion ? (
          <Text style={[styles.portionHint, { color: colors.textSecondary }]}>模型估算：{portion}</Text>
        ) : null}
        {isRecognize ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>份量档位（照片无法精确称重，请选择）</Text>
            <View style={styles.mealRow}>
              {PORTION_TIERS.map((t) => (
                <Chip
                  key={t.key}
                  label={t.label}
                  selected={tier === t.key}
                  onPress={() => selectTier(t.factor, t.key)}
                />
              ))}
            </View>
          </>
        ) : null}
        <Text style={[styles.portionRef, { color: colors.textMuted }]}>{PORTION_REF}</Text>
        <View style={styles.estimateRow}>
          <Button
            title={estimating ? '估算中…' : '按食物库估算营养'}
            variant="secondary"
            icon="calculator-outline"
            loading={estimating}
            fullWidth={false}
            onPress={reestimate}
          />
          {nutritionSource ? (
            <Text style={[styles.source, { color: colors.textMuted }]} numberOfLines={2}>
              来源：{nutritionSource}
            </Text>
          ) : null}
        </View>
        {estimateMsg ? (
          <Text style={[styles.estimateMsg, { color: colors.textSecondary }]}>{estimateMsg}</Text>
        ) : null}
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

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        热量为估算值，非精确测量。份量与用油、酱料、配方等无法从照片可靠判断，请确认后再保存。
      </Text>

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
  ingredients: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.sm },
  mealRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  formGap: { gap: 0 },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  source: { flex: 1, fontSize: fontSize.xs },
  estimateMsg: { fontSize: fontSize.xs, marginBottom: spacing.sm },
  macroRow: { flexDirection: 'row', gap: spacing.sm },
  macroCol: { flex: 1 },
  portionHint: { fontSize: fontSize.sm, marginTop: -spacing.xs, marginBottom: spacing.xs },
  portionRef: { fontSize: fontSize.xs, lineHeight: 17, marginBottom: spacing.sm },
  hint: { fontSize: fontSize.xs, lineHeight: 17, marginTop: -spacing.sm, marginBottom: spacing.lg },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
