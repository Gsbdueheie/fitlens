import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge, Button, Screen } from '@/components/ui';
import { radius, spacing, useTheme, fontSize } from '@/constants/theme';
import { getFoodRecognitionService } from '@/services/ai';
import { setDraft } from '@/services/ai/draft';

export default function FoodRecognizeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

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
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    };
    const res =
      kind === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setImageUri(asset.uri);
    void runRecognition(asset.uri, asset.base64 ?? undefined, asset.mimeType ?? undefined);
  }

  async function runRecognition(
    uri: string,
    base64?: string,
    mime?: string,
  ) {
    setRecognizing(true);
    setError(null);
    try {
      const result = await getFoodRecognitionService().recognize({
        imageUri: uri,
        imageBase64: base64,
        mimeType: mime,
      });
      setDraft({ imageUri: uri, result });
      router.replace('/food-review');
    } catch (e) {
      setError(e instanceof Error ? e.message : '识别失败，请重试');
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
            将为你估算食物名称、份量与营养（Demo 为模拟结果，请确认后再保存）
          </Text>
        </View>
      )}

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
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
        <Badge label="Demo" color={colors.warning} />
        <Text style={[styles.noteText, { color: colors.textSecondary }]}>
          当前为模拟识别：不会读取图片真实内容，结果基于预设示例，仅用于演示完整流程。
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
    backgroundColor: '#00000010',
  },
  preview: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  overlayText: { fontSize: fontSize.md, fontWeight: '600' },
  dropzone: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  dropTitle: { fontSize: fontSize.lg, fontWeight: '700' },
  dropDesc: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  error: { fontSize: fontSize.sm, marginTop: spacing.md, lineHeight: 20 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  noteText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },
});
