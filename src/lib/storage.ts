import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 数据持久化层（单设备 Demo）。
 * 说明：本应用使用设备本地存储（Web 为 localStorage，原生为 AsyncStorage），
 * 数据仅保存在当前设备，不构成真实账号系统，也无法跨设备同步。
 * 真实短信登录与云端同步需后端支持（见 README「Demo 与真实服务的区别」）。
 */

export const STORAGE_KEYS = {
  profile: 'fitlens.profile',
  workouts: 'fitlens.workouts',
  foods: 'fitlens.foods',
  measurements: 'fitlens.measurements',
  manualBurns: 'fitlens.manualBurns',
} as const;

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // 存储失败不应阻断核心流程；记录到控制台便于排查
    console.warn('[FitLens] 保存失败', key, e);
  }
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}
