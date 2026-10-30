import { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './ui';
import { fontSize, radius, spacing, useTheme } from '@/constants/theme';

/**
 * Web 端浏览器摄像头（getUserMedia）拍照组件。
 * 仅在 Web 使用：打开真实摄像头预览 → 拍照 → 通过 canvas 生成 JPEG data URL。
 * 处理：无摄像头、权限被拒、非 HTTPS、设备被占用、浏览器不支持等情况，
 * 均给出明确中文提示并保留「从相册选择」作为替代入口（由父组件提供）。
 */

export interface WebCameraProps {
  onCapture: (dataUrl: string, mime: string, base64: string) => void;
  onCancel: () => void;
}

export function WebCamera({ onCapture, onCancel }: WebCameraProps) {
  const { colors } = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<'starting' | 'ready' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function stop() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    async function start() {
      setPhase('starting');
      setErrorMsg(null);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setErrorMsg('当前浏览器不支持摄像头调用，请改用「从相册选择」上传。');
        setPhase('error');
        return;
      }
      if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) {
        setErrorMsg('当前页面非 HTTPS，浏览器禁止调用摄像头；请使用 HTTPS 或 localhost，或改用「从相册选择」。');
        setPhase('error');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setPhase('ready');
      } catch (e) {
        const err = e as DOMException;
        let msg: string;
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          msg = '相机权限被拒绝：请在浏览器地址栏允许相机权限，或改用「从相册选择」。';
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          msg = '未检测到可用摄像头，请改用「从相册选择」。';
        } else if (err?.name === 'NotReadableError') {
          msg = '摄像头被其他应用占用或不可用，请关闭后重试。';
        } else {
          msg = '无法启动摄像头，请确认使用 HTTPS 或 localhost，或改用「从相册选择」。';
        }
        setErrorMsg(msg);
        setPhase('error');
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [attempt]);

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onCapture(dataUrl, 'image/jpeg', base64);
  }

  function cancel() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onCancel();
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface }]}>
      {phase === 'error' ? (
        <View style={styles.state}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{errorMsg}</Text>
          <View style={styles.btnRow}>
            <Button title="重试" variant="secondary" fullWidth={false} onPress={() => setAttempt((n) => n + 1)} />
            <Button title="取消" variant="ghost" fullWidth={false} onPress={cancel} />
          </View>
        </View>
      ) : (
        <View style={styles.preview}>
          {createElement('video', {
            ref: videoRef,
            style: videoStyle,
            playsInline: true,
            muted: true,
            autoPlay: true,
          })}
          {phase === 'starting' ? (
            <View style={styles.state}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>正在启动摄像头…</Text>
            </View>
          ) : null}
        </View>
      )}

      {phase !== 'error' ? (
        <View style={styles.btnRow}>
          <Button title="拍照" icon="camera" onPress={capture} disabled={phase !== 'ready'} />
          <Button title="取消" variant="secondary" onPress={cancel} />
        </View>
      ) : null}
    </View>
  );
}

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  backgroundColor: '#000',
};

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden' },
  preview: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#000' },
  state: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  stateText: { fontSize: fontSize.sm },
  errorText: { fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
});
