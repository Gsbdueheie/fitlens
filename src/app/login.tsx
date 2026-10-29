import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Screen } from '@/components/ui';
import { radius, spacing, useTheme, fontSize } from '@/constants/theme';
import { useApp } from '@/context/app';

const PHONE_RE = /^1\d{10}$/;

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { demoLogin } = useApp();
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const phoneValid = PHONE_RE.test(phone);
  const phoneError = touched && !phoneValid ? '请输入 11 位大陆手机号' : null;

  async function handleDemoLogin() {
    setBusy(true);
    await demoLogin(phoneValid ? phone : null);
  }

  return (
    <Screen maxWidth={440}>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Ionicons name="fitness" size={34} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>FitLens</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          记录训练 · 饮食 · 身体数据，用 AI 降低饮食记录成本
        </Text>
      </View>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>手机号登录</Text>
        <Field
          label="手机号"
          value={phone}
          onChangeText={(t) => {
            setPhone(t.replace(/\D/g, '').slice(0, 11));
            setTouched(true);
          }}
          placeholder="请输入 11 位手机号"
          keyboardType="phone-pad"
          maxLength={11}
          error={phoneError}
        />
        <Button
          title="获取验证码"
          icon="chatbubble-ellipses-outline"
          disabled={!phoneValid}
          onPress={() => router.push({ pathname: '/verify', params: { phone } })}
        />

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>或</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <Button
          title="一键 Demo 登录（无需短信）"
          variant="secondary"
          icon="flash-outline"
          loading={busy}
          onPress={handleDemoLogin}
        />
      </Card>

      <Card style={[styles.notice, { backgroundColor: colors.primarySoft, borderColor: 'transparent' }]}>
        <View style={styles.noticeRow}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primaryDeep} />
          <Text style={[styles.noticeText, { color: colors.text }]}>
            Demo 模式说明：本演示未接入真实短信服务，验证码为固定演示值；数据仅保存在当前设备（浏览器本地存储），不构成正式账号系统。
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xxl, gap: spacing.sm },
  logo: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  card: { gap: spacing.md, paddingVertical: spacing.xl },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: fontSize.xs },
  notice: { marginTop: spacing.lg },
  noticeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },
});
