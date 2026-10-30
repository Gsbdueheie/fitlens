/**
 * 后端 API 客户端。
 * 后端地址通过 EXPO_PUBLIC_API_URL 配置（这是公开的服务地址，不是密钥）。
 * 密钥（DEEPSEEK_API_KEY 等）只存在于后端，前端绝不接触。
 * 会话 token 由 AppProvider 统一从本地 session 读取并显式传入，不在此处单独存储。
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ReqOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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
  avatarUrl: string | null;
  avatarVersion: number | null; // 头像版本（服务端版本化存储的版本号，随头像变化）
  goal: 'lose' | 'gain' | 'maintain';
  targetKcal: number | null;
  heightCm: number | null;
  weightKg: number | null;
  age: number | null;
  gender: 'male' | 'female' | null;
  createdAt: string;
  updatedAt: string;
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
  updateMe: (token: string, body: import('@/lib/types').ProfilePatch & { nickname?: string }) =>
    request<{ user: ServerUser }>('/api/auth/me', { method: 'PATCH', token, body }),
  uploadAvatar: (token: string, body: { imageBase64: string; mimeType: string }) =>
    request<{ user: ServerUser }>('/api/avatar', { method: 'POST', token, body }),

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

  searchFoods: (token: string, query: string) =>
    request<{ foods: import('@/lib/types').FoodEntry[] }>(
      `/api/foods/search?q=${encodeURIComponent(query)}`,
      { token },
    ),

  chat: (token: string, messages: import('@/lib/types').ChatMessage[]) =>
    request<{ reply: string }>('/api/chat', { method: 'POST', token, body: { messages } }),

  records: (token: string) =>
    request<{ records: import('@/lib/types').UserRecords }>('/api/records', { token }),
  putRecords: (token: string, records: import('@/lib/types').UserRecords) =>
    request<{ ok: boolean }>('/api/records', { method: 'PUT', token, body: { records } }),
  deleteRecords: (token: string) =>
    request<{ ok: boolean }>('/api/records', { method: 'DELETE', token }),
};
