import { Platform } from 'react-native';

/**
 * Web 端图片选择工具（仅 Web 使用，原生走 expo-image-picker）。
 * 通过隐藏 <input type="file"> + FileReader 读取，保证能得到 base64，
 * 并在读取前校验格式与体积。原生环境不会走到这里（调用方需用 isWeb 分流）。
 */

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function isWeb(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined' && typeof window !== 'undefined';
}

export interface PickedImage {
  dataUrl: string; // data:image/...;base64,xxxx（可直接用于 Image source）
  base64: string; // 纯 base64（发送给后端）
  mime: string;
}

export function pickWebImage(): Promise<{ ok: true; image: PickedImage } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    if (!isWeb()) {
      resolve({ ok: false, error: '当前环境不支持此操作' });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    let settled = false;
    const done = (r: { ok: true; image: PickedImage } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(r);
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        done({ ok: false, error: '未选择图片' });
        return;
      }
      const mime = file.type || 'image/jpeg';
      if (!ALLOWED_MIME.includes(mime)) {
        done({ ok: false, error: '不支持的图片格式，请使用 JPG/PNG/WebP/GIF' });
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        done({ ok: false, error: '图片超过 20MB，请压缩或选择更小的图片' });
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        done({ ok: true, image: { dataUrl, base64, mime } });
      } catch {
        done({ ok: false, error: '读取图片失败，请重试' });
      }
    });

    // 用户取消选择时（桌面浏览器支持 cancel 事件）
    input.addEventListener('cancel', () => done({ ok: false, error: '' }));

    document.body.appendChild(input);
    input.click();
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
