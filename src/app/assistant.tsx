import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Chip, Screen } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { type ChatMessage } from '@/lib/types';
import { api, ApiError } from '@/services/api';

const SUGGESTIONS = [
  '帮我制定一周减脂训练计划',
  '新手适合买什么健身器材？',
  '如何结合饮食记录控制热量？',
];

export default function AssistantScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !session?.token || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError(null);
    setSending(true);
    try {
      const res = await api.chat(session.token, next);
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '发送失败，请重试');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen title="智能助手" onBack={() => router.back()} scroll={false} fill bottomInset={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {messages.length === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="chatbubbles-outline" size={30} color={colors.primaryDeep} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>减脂与健身助手</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              可以问我减脂方法、训练计划、动作要领或器材选择。建议仅供参考，不构成医疗建议。
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} onPress={() => send(s)} />
              ))}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <View
                  key={i}
                  style={[
                    styles.bubbleRow,
                    isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isUser
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text style={[styles.bubbleText, { color: isUser ? colors.onPrimary : colors.text }]}>
                      {m.content}
                    </Text>
                  </View>
                </View>
              );
            })}
            {sending ? (
              <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                <View style={[styles.bubble, { backgroundColor: colors.surface }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            <Pressable onPress={() => setError(null)} hitSlop={8} accessibilityLabel="关闭提示">
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="输入你的问题…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceAlt }]}
          />
          <Button
            title="发送"
            icon="send"
            onPress={() => send()}
            loading={sending}
            disabled={!input.trim() || sending}
            fullWidth={false}
            style={styles.sendBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700' },
  emptyDesc: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  list: { paddingVertical: spacing.md, gap: spacing.md },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  bubbleText: { fontSize: fontSize.md, lineHeight: 22 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginHorizontal: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm },
  errorText: { flex: 1, fontSize: fontSize.xs, lineHeight: 17 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
  },
  sendBtn: { alignSelf: 'flex-end' },
});
