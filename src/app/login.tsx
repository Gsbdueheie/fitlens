import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Screen } from '@/components/ui';
import { radius, spacing, useTheme, fontSize } from '@/constants/theme';
import { useApp } from '@/context/app';
import { api, ApiError } from '@/services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 与后端 validPassword 规则一致：至少 8 位 + 至少一个字母 + 至少一个数字（不要求特殊字符）。
const PASSWORD_RULES: { key: string; label: string; test: (p: string) => boolean }[] = [
  { key: 'length', label: '至少 8 位', test: (p) => p.length >= 8 },
  { key: 'letter', label: '至少一个字母', test: (p) => /[A-Za-z]/.test(p) },
  { key: 'digit', label: '至少一个数字', test: (p) => /\d/.test(p) },
];

/** 密码明文/密文切换按钮（挂在 Field 的 right 插槽）。 */
function EyeToggle({ show, onPress, label }: { show: boolean; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={show ? `隐藏${label}` : `显示${label}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
    </Pressable>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 确认密码即时校验：一旦输入了确认密码且与密码不一致，立即在输入框下方提示。
  const confirmMismatch = mode === 'register' && confirm.length > 0 && password !== confirm;

  const passwordRules = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));

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

        {mode === 'register' ? (
          <Field label="昵称" value={nickname} onChangeText={setNickname} placeholder="你的昵称" maxLength={20} />
        ) : null}

        {/* 密码在上、确认密码在下一行，两项相邻且始终上下排列 */}
        <Field
          label="密码"
          value={password}
          onChangeText={setPassword}
          placeholder="至少 8 位，含字母和数字"
          secureTextEntry={!showPassword}
          right={<EyeToggle show={showPassword} onPress={() => setShowPassword((v) => !v)} label="密码" />}
        />

        {mode === 'register' ? (
          <Field
            label="确认密码"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="再次输入密码"
            secureTextEntry={!showConfirm}
            error={confirmMismatch ? '两次输入的密码不一致' : null}
            right={<EyeToggle show={showConfirm} onPress={() => setShowConfirm((v) => !v)} label="确认密码" />}
          />
        ) : null}

        {mode === 'register' ? (
          <View style={styles.rules}>
            {passwordRules.map((r) => (
              <View key={r.key} style={styles.ruleRow}>
                <Ionicons
                  name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={r.ok ? colors.success : colors.textMuted}
                />
                <Text style={[styles.ruleText, { color: r.ok ? colors.success : colors.textMuted }]}>
                  {r.label}
                </Text>
              </View>
            ))}
          </View>
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
            账号、密码、头像与个人资料（身高/体重/目标等）均安全存储于服务端，验证码由服务端校验；训练/饮食/身体测量记录仍保存在本机，跨设备同步尚未实现。
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
  rules: { gap: 2, marginTop: -spacing.xs, marginBottom: spacing.sm },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontSize: fontSize.xs },
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
