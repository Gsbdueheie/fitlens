import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Screen } from '@/components/ui';
import { radius, spacing, useTheme, fontSize } from '@/constants/theme';
import { useApp } from '@/context/app';
import { api, ApiError } from '@/services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { login, register } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [confirm, setConfirm] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshCaptcha() {
    try {
      const c = await api.captcha();
      setCaptchaId(c.captchaId);
      setCaptchaSvg(c.svg);
      setCaptchaInput('');
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '无法加载验证码');
    }
  }

  useEffect(() => {
    let cancelled = false;
    api
      .captcha()
      .then((c) => {
        if (cancelled) return;
        setCaptchaId(c.captchaId);
        setCaptchaSvg(c.svg);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : '无法加载验证码');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function validate(): string | null {
    if (!EMAIL_RE.test(email.trim())) return '请输入有效的邮箱地址';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return '密码需至少 8 位，且同时包含字母和数字';
    }
    if (mode === 'register') {
      if (!nickname.trim()) return '请输入昵称';
      if (password !== confirm) return '两次输入的密码不一致';
    }
    if (!captchaInput.trim()) return '请输入验证码';
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password, captchaId, captchaInput.trim());
      } else {
        await register(email.trim(), password, nickname.trim(), captchaId, captchaInput.trim());
      }
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '操作失败，请稍后重试');
      refreshCaptcha();
    } finally {
      setBusy(false);
    }
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
        {/* 登录/注册切换 */}
        <View style={[styles.modeSwitch, { backgroundColor: colors.surfaceAlt }]}>
          {(['login', 'register'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMode(m);
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              style={[styles.modeBtn, mode === m && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.modeText, { color: mode === m ? colors.text : colors.textSecondary }]}>
                {m === 'login' ? '登录' : '注册'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="邮箱"
          value={email}
          onChangeText={(t) => setEmail(t.trim())}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field label="密码" value={password} onChangeText={setPassword} placeholder="至少 8 位，含字母和数字" secureTextEntry />

        {mode === 'register' ? (
          <>
            <Field label="昵称" value={nickname} onChangeText={setNickname} placeholder="你的昵称" maxLength={20} />
            <Field label="确认密码" value={confirm} onChangeText={setConfirm} placeholder="再次输入密码" secureTextEntry />
          </>
        ) : null}

        {/* 图形验证码 */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>验证码</Text>
        <View style={styles.captchaRow}>
          {captchaSvg ? (
            <Pressable onPress={refreshCaptcha} accessibilityRole="button" accessibilityLabel="点击刷新验证码">
              <Image source={{ uri: captchaSvg }} style={styles.captchaImg} />
            </Pressable>
          ) : (
            <View style={[styles.captchaImg, styles.captchaPlaceholder, { backgroundColor: colors.surfaceAlt }]} />
          )}
          <View style={styles.captchaInputWrap}>
            <Field
              label=""
              value={captchaInput}
              onChangeText={(t) => setCaptchaInput(t.toUpperCase())}
              placeholder="输入右侧字符"
              maxLength={4}
            />
          </View>
        </View>
        <Text style={[styles.captchaHint, { color: colors.textMuted }]}>点击图片可刷新验证码</Text>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button title={mode === 'login' ? '登录' : '注册'} loading={busy} onPress={submit} icon="log-in-outline" />
      </Card>

      <Card style={[styles.notice, { backgroundColor: colors.primarySoft, borderColor: 'transparent' }]}>
        <View style={styles.noticeRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryDeep} />
          <Text style={[styles.noticeText, { color: colors.text }]}>
            账号密码由服务端安全存储（bcrypt 哈希）；验证码由服务端校验。训练/饮食/身体记录当前保存在本机，跨设备同步尚未实现。
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xxl, gap: spacing.sm },
  logo: { width: 68, height: 68, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  card: { gap: spacing.sm, paddingVertical: spacing.xl },
  modeSwitch: { flexDirection: 'row', borderRadius: radius.md, padding: 3, marginBottom: spacing.sm },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md },
  modeText: { fontSize: fontSize.sm, fontWeight: '600' },
  label: { fontSize: fontSize.sm, fontWeight: '600' },
  captchaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  captchaImg: { width: 120, height: 44, borderRadius: radius.sm },
  captchaPlaceholder: {},
  captchaInputWrap: { flex: 1 },
  captchaHint: { fontSize: fontSize.xs, marginTop: -spacing.xs },
  error: { fontSize: fontSize.sm, lineHeight: 20 },
  notice: { marginTop: spacing.lg },
  noticeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },
});
