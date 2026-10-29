import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 后端 API 客户端。
 * 后端地址通过 EXPO_PUBLIC_API_URL 配置（这是公开的服务地址，不是密钥）。
 * 密钥（DEEPSEEK_API_KEY 等）只存在于后端，前端绝不接触。
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'fitlens.authToken';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

interface ReqOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, opts: ReqOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('无法连接服务器，请确认后端已启动', 0);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(String(data.error || '请求失败，请稍后重试'), res.status);
  }
  return data as T;
}

export interface ServerUser {
  id: string;
  email: string;
  nickname: string;
  createdAt: string;
}

export const api = {
  health: () => request<{ ok: boolean; aiConfigured: boolean; captchaProvider: string }>('/api/health'),
  captcha: () => request<{ captchaId: string; svg: string }>('/api/captcha', { method: 'POST' }),

  register: (body: { email: string; password: string; nickname?: string; captchaId: string; captchaInput: string }) =>
    request<{ token: string; user: ServerUser }>('/api/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string; captchaId: string; captchaInput: string }) =>
    request<{ token: string; user: ServerUser }>('/api/auth/login', { method: 'POST', body }),
  logout: (token: string) => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', token }),
  me: (token: string) => request<{ user: ServerUser }>('/api/auth/me', { token }),
  updateMe: (token: string, body: { nickname: string }) =>
    request<{ user: ServerUser }>('/api/auth/me', { method: 'PATCH', token, body }),

  recognize: (token: string, body: { imageBase64: string; mimeType: string }) =>
    request<{ foods: import('@/lib/types').RecognizedFood[]; uncertainty: string }>('/api/recognize', {
      method: 'POST',
      token,
      body,
    }),
  nutrition: (token: string, body: { name: string; amount: number }) =>
    request<{ nutrition: import('@/lib/types').NutritionEstimate | null }>('/api/nutrition', {
      method: 'POST',
      token,
      body,
    }),
};
