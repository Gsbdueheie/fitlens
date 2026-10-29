import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';
import { useApp } from '@/context/app';
import { api, ApiError } from '@/services/api';
import { setDraft } from '@/services/ai/draft';

export default function FoodRecognizeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useApp();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(kind: 'camera' | 'library') {
    setError(null);
    if (kind === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('需要相机权限才能拍照，请在系统设置中开启，或改为上传图片。');
        return;
      }
    }
    const res =
      kind === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });

    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setImageUri(asset.uri);
    await runRecognition(asset.uri, asset.base64 ?? undefined, asset.mimeType);
  }

  async function runRecognition(uri: string, base64?: string, mime?: string) {
    if (!session?.token) return;
    setRecognizing(true);
    setError(null);
    try {
      if (!base64) {
        setError('无法读取图片数据，请重新选择');
        return;
      }
      const response = await api.recognize(session.token, {
        imageBase64: base64,
        mimeType: mime || 'image/jpeg',
      });
      setDraft({ imageUri: uri, response });
      router.replace('/food-review');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '识别失败，请重试');
    } finally {
      setRecognizing(false);
    }
  }

  return (
    <Screen title="拍照识别" onBack={() => router.back()}>
      {imageUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          {recognizing && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.overlayText, { color: colors.text }]}>正在识别…</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.dropzone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.dropTitle, { color: colors.text }]}>拍摄或上传食物照片</Text>
          <Text style={[styles.dropDesc, { color: colors.textSecondary }]}>
            图片将由服务端转发给 DeepSeek 视觉模型（deepseek-flash）识别，请确认结果后再保存
          </Text>
        </View>
      )}

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {Platform.OS !== 'web' ? (
          <Button title="拍照" icon="camera" onPress={() => pick('camera')} disabled={recognizing} />
        ) : null}
        <Button
          title="从相册选择"
          icon="images-outline"
          variant="secondary"
          onPress={() => pick('library')}
          disabled={recognizing}
        />
      </View>

      <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.noteText, { color: colors.textSecondary }]}>
          识别结果为模型估算（含不确定性说明），份量无法从照片精确测得，请确认或修正后保存。
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewWrap: { borderRadius: radius.lg, overflow: 'hidden', aspectRatio: 4 / 3, backgroundColor: '#00000010' },
  preview: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  overlayText: { fontSize: fontSize.md, fontWeight: '600' },
  dropzone: {
    borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.xxl * 2, paddingHorizontal: spacing.xl,
  },
  dropTitle: { fontSize: fontSize.lg, fontWeight: '700' },
  dropDesc: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  errorText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
  note: { padding: spacing.md, borderRadius: radius.md, marginTop: spacing.xl },
  noteText: { fontSize: fontSize.xs, lineHeight: 18 },
});
