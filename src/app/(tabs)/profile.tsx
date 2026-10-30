import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Chip, Field, Screen, SectionTitle } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { confirmDialog } from '@/lib/confirm';
import { KCAL_UNIT_NOTE } from '@/lib/format';
import { GOAL_TARGET_NOTE } from '@/lib/nutrition';
import { GOAL_LABEL, type Gender, type Goal } from '@/lib/types';
import { ApiError } from '@/services/api';

const GOALS: Goal[] = ['lose', 'maintain', 'gain'];

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { profile, updateNickname, updatePrefs, logout, seedSampleData, clearAll } = useApp();

  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'lose');
  const [target, setTarget] = useState(profile?.targetKcal != null ? String(profile.targetKcal) : '');
  const [height, setHeight] = useState(profile?.heightCm != null ? String(profile.heightCm) : '');
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
  const [gender, setGender] = useState<Gender>(profile?.gender ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    const uri = asset.base64
      ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
      : asset.uri;
    await updatePrefs({ avatarUri: uri });
  }

  async function saveProfile() {
    const targetNum = target.trim() === '' ? null : parseFloat(target);
    const heightNum = height.trim() === '' ? null : parseFloat(height);
    const ageNum = age.trim() === '' ? null : parseInt(age, 10);

    setSaving(true);
    setError(null);
    try {
      await updateNickname(nickname.trim() || 'FitLens 用户');
      await updatePrefs({
        goal,
        targetKcal: targetNum != null && !isNaN(targetNum) && targetNum > 0 ? Math.round(targetNum) : null,
        heightCm: heightNum != null && !isNaN(heightNum) && heightNum > 0 ? heightNum : null,
        age: ageNum != null && !isNaN(ageNum) && ageNum > 0 ? ageNum : null,
        gender,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.stack}>
        {/* 头像 + 账号 */}
        <Card>
          <View style={styles.avatarRow}>
            <Pressable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel="更换头像">
              {profile?.avatarUri ? (
                <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="person" size={32} color={colors.primaryDeep} />
                </View>
              )}
              <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </Pressable>
            <View style={styles.avatarInfo}>
              <Text style={[styles.email, { color: colors.textSecondary }]}>{profile?.email ?? ''}</Text>
              <View style={styles.badgeRow}>
                <Badge label="已登录" color={colors.success} icon="shield-checkmark-outline" />
              </View>
            </View>
          </View>
        </Card>

        {/* 资料 */}
        <Card>
          <SectionTitle title="个人资料" style={styles.cardTitle} />
          <Field label="昵称" value={nickname} onChangeText={setNickname} placeholder="你的昵称" maxLength={20} />

          <Text style={[styles.label, { color: colors.textSecondary }]}>健身目标</Text>
          <View style={styles.chips}>
            {GOALS.map((g) => (
              <Chip key={g} label={GOAL_LABEL[g]} selected={goal === g} onPress={() => setGoal(g)} />
            ))}
          </View>

          <View style={styles.formGap}>
            <Field
              label="每日目标摄入（选填，留空按目标默认）"
              value={target}
              onChangeText={(t) => setTarget(t.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
              suffix="卡"
            />
            <Field
              label="身高（选填）"
              value={height}
              onChangeText={(t) => setHeight(t.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              suffix="cm"
            />
            <Field
              label="年龄（选填）"
              value={age}
              onChangeText={(t) => setAge(t.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
              suffix="岁"
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>性别（选填）</Text>
          <View style={styles.chips}>
            {([null, 'male', 'female'] as Gender[]).map((g) => (
              <Chip
                key={String(g)}
                label={g == null ? '不填' : g === 'male' ? '男' : '女'}
                selected={gender === g}
                onPress={() => setGender(g)}
              />
            ))}
          </View>

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          <View style={styles.saveRow}>
            <Button title={saved ? '已保存 ✓' : '保存资料'} icon={saved ? 'checkmark' : 'save-outline'} loading={saving} onPress={saveProfile} />
          </View>
        </Card>

        {/* 说明 */}
        <Card>
          <SectionTitle title="使用说明" style={styles.cardTitle} />
          <View style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{KCAL_UNIT_NOTE}</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{GOAL_TARGET_NOTE}</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
              账号与密码由服务端安全存储；训练/饮食/身体记录当前保存在本机（单设备），跨设备同步尚未实现。
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
              食物识别由 DeepSeek 视觉模型完成，热量为估算值，请以「确认/修正」为准。
            </Text>
          </View>
        </Card>

        {/* 数据管理 */}
        <Card>
          <SectionTitle title="数据管理" style={styles.cardTitle} />
          <View style={styles.manageRows}>
            <Button title="加载示例数据" variant="secondary" icon="sparkles-outline" onPress={() => seedSampleData()} />
            <Button
              title="清除本机数据"
              variant="secondary"
              icon="trash-outline"
              onPress={() =>
                confirmDialog('清除数据', '将删除本机保存的所有记录并退出登录，确定继续？', () => clearAll())
              }
            />
            <Button
              title="退出登录"
              variant="dangerGhost"
              icon="log-out-outline"
              onPress={() => confirmDialog('退出登录', '确定退出当前账号吗？', () => logout())}
            />
          </View>
        </Card>

        <Text style={[styles.version, { color: colors.textMuted }]}>FitLens · v1.1.0</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: radius.pill },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  avatarInfo: { gap: spacing.sm },
  email: { fontSize: fontSize.md, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  cardTitle: { marginTop: 0 },
  label: { fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  formGap: { gap: 0 },
  error: { fontSize: fontSize.sm, marginTop: spacing.sm },
  saveRow: { marginTop: spacing.md },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  bullet: { width: 8 },
  bulletText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },
  manageRows: { gap: spacing.md },
  version: { textAlign: 'center', fontSize: fontSize.xs },
});
