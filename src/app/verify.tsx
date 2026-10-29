import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Screen } from '@/components/ui';
import { radius, spacing, useTheme, fontSize } from '@/constants/theme';
import { useApp } from '@/context/app';

const DEMO_CODE = '123456';

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const { colors } = useTheme();
  const { demoLogin } = useApp();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const maskedPhone = phone ? `${phone.slice(0, 3)}****${phone.slice(7)}` : '';

  async function submit() {
    if (code !== DEMO_CODE) {
      setError('验证码不正确（Demo 固定为 123456）');
      return;
    }
    setBusy(true);
    await demoLogin(phone ?? null);
  }

  return (
    <Screen title="输入验证码" onBack={() => router.back()} maxWidth={440}>
      <Card style={styles.card}>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          验证码已发送至 {maskedPhone || '你的手机'}
        </Text>

        <View style={[styles.demoBanner, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="flask-outline" size={16} color={colors.primaryDeep} />
          <Text style={[styles.demoText, { color: colors.text }]}>
            Demo 模式：未真实发送短信，验证码固定为 {DEMO_CODE}
          </Text>
        </View>

        <Field
          label="验证码"
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          placeholder="6 位数字验证码"
          keyboardType="number-pad"
          maxLength={6}
          error={error}
        />

        <Button title="登录" loading={busy} onPress={submit} icon="log-in-outline" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginTop: spacing.md },
  desc: { fontSize: fontSize.md },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  demoText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },
});
