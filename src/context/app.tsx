import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  BodyMeasurement,
  FoodRecord,
  ManualBurn,
  UserProfile,
  WorkoutRecord,
  type ProfilePatch,
} from '@/lib/types';
import { loadJSON, saveJSON, clearAllData, STORAGE_KEYS } from '@/lib/storage';
import { buildSeedData } from '@/lib/seed';
import { uid } from '@/lib/util';
import { api, ApiError, type ServerUser } from '@/services/api';

export interface Session {
  token: string;
  user: ServerUser;
}

export interface AppState {
  ready: boolean;
  session: Session | null;
  profile: UserProfile | null; // 由 session.user（服务端资料）派生
  workouts: WorkoutRecord[];
  foods: FoodRecord[];
  measurements: BodyMeasurement[];
  manualBurns: ManualBurn[];

  login: (email: string, password: string, captchaId: string, captchaInput: string) => Promise<void>;
  register: (email: string, password: string, nickname: string, captchaId: string, captchaInput: string) => Promise<void>;
  logout: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  updateAvatar: (imageBase64: string, mimeType: string) => Promise<void>;

  saveWorkout: (record: WorkoutRecord) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  saveFood: (record: FoodRecord) => Promise<void>;
  deleteFood: (id: string) => Promise<void>;
  saveMeasurement: (record: BodyMeasurement) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  saveManualBurn: (record: ManualBurn) => Promise<void>;
  deleteManualBurn: (id: string) => Promise<void>;

  seedSampleData: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [foods, setFoods] = useState<FoodRecord[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [manualBurns, setManualBurns] = useState<ManualBurn[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, w, f, m, b] = await Promise.all([
        loadJSON<Session | null>(STORAGE_KEYS.session, null),
        loadJSON<WorkoutRecord[]>(STORAGE_KEYS.workouts, []),
        loadJSON<FoodRecord[]>(STORAGE_KEYS.foods, []),
        loadJSON<BodyMeasurement[]>(STORAGE_KEYS.measurements, []),
        loadJSON<ManualBurn[]>(STORAGE_KEYS.manualBurns, []),
      ]);
      if (cancelled) return;
      setSession(s);
      setWorkouts(w);
      setFoods(f);
      setMeasurements(m);
      setManualBurns(b);
      setReady(true);

      // 服务端是资料数据源；登录态存在时后台刷新（本地缓存仅作快速显示）。
      if (s?.token) {
        try {
          const res = await api.me(s.token);
          if (cancelled) return;
          const next = { token: s.token, user: res.user };
          setSession(next);
          await saveJSON(STORAGE_KEYS.session, next);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401 && !cancelled) {
            setSession(null);
            await saveJSON(STORAGE_KEYS.session, null);
          }
          // 其他错误（网络失败等）：保留本地缓存，登录后可重试
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = useMemo<UserProfile | null>(() => {
    if (!session) return null;
    const u = session.user;
    return {
      email: u.email,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      goal: u.goal,
      targetKcal: u.targetKcal,
      heightCm: u.heightCm,
      weightKg: u.weightKg,
      age: u.age,
      gender: u.gender,
    };
  }, [session]);

  const apiState = useMemo<AppState>(() => {
    async function login(email: string, password: string, captchaId: string, captchaInput: string) {
      const res = await api.login({ email, password, captchaId, captchaInput });
      const s: Session = { token: res.token, user: res.user };
      setSession(s);
      await saveJSON(STORAGE_KEYS.session, s);
    }

    async function register(email: string, password: string, nickname: string, captchaId: string, captchaInput: string) {
      const res = await api.register({ email, password, nickname, captchaId, captchaInput });
      const s: Session = { token: res.token, user: res.user };
      setSession(s);
      await saveJSON(STORAGE_KEYS.session, s);
    }

    async function logout() {
      const token = session?.token;
      if (token) {
        try {
          await api.logout(token);
        } catch {
          // 网络失败时仍允许本地退出
        }
      }
      setSession(null);
      await saveJSON(STORAGE_KEYS.session, null);
    }

    async function updateNickname(nickname: string) {
      const token = session?.token;
      if (!token) return;
      const res = await api.updateMe(token, { nickname });
      setSession((prev) => (prev ? { ...prev, user: res.user } : prev));
      await saveJSON(STORAGE_KEYS.session, { token, user: res.user });
    }

    async function updateProfile(patch: ProfilePatch) {
      const token = session?.token;
      if (!token) return;
      const res = await api.updateMe(token, patch);
      setSession((prev) => (prev ? { ...prev, user: res.user } : prev));
      await saveJSON(STORAGE_KEYS.session, { token, user: res.user });
    }

    async function updateAvatar(imageBase64: string, mimeType: string) {
      const token = session?.token;
      if (!token) return;
      const res = await api.uploadAvatar(token, { imageBase64, mimeType });
      setSession((prev) => (prev ? { ...prev, user: res.user } : prev));
      await saveJSON(STORAGE_KEYS.session, { token, user: res.user });
    }

    async function saveWorkout(record: WorkoutRecord) {
      setWorkouts((prev) => {
        const idx = prev.findIndex((x) => x.id === record.id);
        const next = idx >= 0 ? prev.map((x, i) => (i === idx ? record : x)) : [record, ...prev];
        saveJSON(STORAGE_KEYS.workouts, next);
        return next;
      });
    }

    async function deleteWorkout(id: string) {
      setWorkouts((prev) => {
        const next = prev.filter((x) => x.id !== id);
        saveJSON(STORAGE_KEYS.workouts, next);
        return next;
      });
    }

    async function saveFood(record: FoodRecord) {
      setFoods((prev) => {
        const idx = prev.findIndex((x) => x.id === record.id);
        const next = idx >= 0 ? prev.map((x, i) => (i === idx ? record : x)) : [record, ...prev];
        saveJSON(STORAGE_KEYS.foods, next);
        return next;
      });
    }

    async function deleteFood(id: string) {
      setFoods((prev) => {
        const next = prev.filter((x) => x.id !== id);
        saveJSON(STORAGE_KEYS.foods, next);
        return next;
      });
    }

    async function saveMeasurement(record: BodyMeasurement) {
      setMeasurements((prev) => {
        const idx = prev.findIndex((x) => x.id === record.id);
        const next = idx >= 0 ? prev.map((x, i) => (i === idx ? record : x)) : [record, ...prev];
        saveJSON(STORAGE_KEYS.measurements, next);
        return next;
      });
    }

    async function deleteMeasurement(id: string) {
      setMeasurements((prev) => {
        const next = prev.filter((x) => x.id !== id);
        saveJSON(STORAGE_KEYS.measurements, next);
        return next;
      });
    }

    async function saveManualBurn(record: ManualBurn) {
      setManualBurns((prev) => {
        const idx = prev.findIndex((x) => x.id === record.id);
        const next = idx >= 0 ? prev.map((x, i) => (i === idx ? record : x)) : [record, ...prev];
        saveJSON(STORAGE_KEYS.manualBurns, next);
        return next;
      });
    }

    async function deleteManualBurn(id: string) {
      setManualBurns((prev) => {
        const next = prev.filter((x) => x.id !== id);
        saveJSON(STORAGE_KEYS.manualBurns, next);
        return next;
      });
    }

    async function seedSampleData() {
      const seed = buildSeedData();
      setWorkouts(seed.workouts);
      setFoods(seed.foods);
      setMeasurements(seed.measurements);
      setManualBurns(seed.manualBurns);
      await Promise.all([
        saveJSON(STORAGE_KEYS.workouts, seed.workouts),
        saveJSON(STORAGE_KEYS.foods, seed.foods),
        saveJSON(STORAGE_KEYS.measurements, seed.measurements),
        saveJSON(STORAGE_KEYS.manualBurns, seed.manualBurns),
      ]);
    }

    async function clearAll() {
      setSession(null);
      setWorkouts([]);
      setFoods([]);
      setMeasurements([]);
      setManualBurns([]);
      await clearAllData();
    }

    return {
      ready,
      session,
      profile,
      workouts,
      foods,
      measurements,
      manualBurns,
      login,
      register,
      logout,
      updateNickname,
      updateProfile,
      updateAvatar,
      saveWorkout,
      deleteWorkout,
      saveFood,
      deleteFood,
      saveMeasurement,
      deleteMeasurement,
      saveManualBurn,
      deleteManualBurn,
      seedSampleData,
      clearAll,
    };
  }, [ready, session, profile, workouts, foods, measurements, manualBurns]);

  return <AppContext.Provider value={apiState}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用');
  return ctx;
}

export function makeRecordId(): string {
  return uid();
}
