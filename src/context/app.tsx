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
  UserRecords,
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

  // 登录态（token）变化时，从服务端拉取该用户的记录（训练/饮食/身体测量/手动补充）。
  // 服务端是记录的权威数据源，本地缓存仅作快速显示。
  useEffect(() => {
    const token = session?.token;
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.records(token);
        if (cancelled) return;
        setWorkouts(res.records.workouts);
        setFoods(res.records.foods);
        setMeasurements(res.records.measurements);
        setManualBurns(res.records.manualBurns);
        await Promise.all([
          saveJSON(STORAGE_KEYS.workouts, res.records.workouts),
          saveJSON(STORAGE_KEYS.foods, res.records.foods),
          saveJSON(STORAGE_KEYS.measurements, res.records.measurements),
          saveJSON(STORAGE_KEYS.manualBurns, res.records.manualBurns),
        ]);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401 && !cancelled) {
          setSession(null);
          await saveJSON(STORAGE_KEYS.session, null);
        }
        // 其他错误（网络失败等）：保留本地缓存，之后可重试
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

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
      // 清空本机记录，避免下一个账号登录前串用上一账号的数据（记录已同步在服务端）。
      setWorkouts([]);
      setFoods([]);
      setMeasurements([]);
      setManualBurns([]);
      await Promise.all([
        saveJSON(STORAGE_KEYS.workouts, []),
        saveJSON(STORAGE_KEYS.foods, []),
        saveJSON(STORAGE_KEYS.measurements, []),
        saveJSON(STORAGE_KEYS.manualBurns, []),
      ]);
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

    /** 把记录推送到服务端（服务端为记录的权威数据源）。 */
    async function pushRecords(records: UserRecords) {
      const token = session?.token;
      if (!token) return;
      await api.putRecords(token, records);
    }

    /** 本地持久化 + 推送服务端。next 覆盖需要更新的集合，其余使用当前状态。 */
    async function commitRecords(next: Partial<UserRecords>) {
      const w = next.workouts ?? workouts;
      const f = next.foods ?? foods;
      const m = next.measurements ?? measurements;
      const b = next.manualBurns ?? manualBurns;
      await Promise.all([
        saveJSON(STORAGE_KEYS.workouts, w),
        saveJSON(STORAGE_KEYS.foods, f),
        saveJSON(STORAGE_KEYS.measurements, m),
        saveJSON(STORAGE_KEYS.manualBurns, b),
      ]);
      await pushRecords({ workouts: w, foods: f, measurements: m, manualBurns: b });
    }

    async function saveWorkout(record: WorkoutRecord) {
      const idx = workouts.findIndex((x) => x.id === record.id);
      const next = idx >= 0 ? workouts.map((x, i) => (i === idx ? record : x)) : [record, ...workouts];
      setWorkouts(next);
      await commitRecords({ workouts: next });
    }

    async function deleteWorkout(id: string) {
      const next = workouts.filter((x) => x.id !== id);
      setWorkouts(next);
      await commitRecords({ workouts: next });
    }

    async function saveFood(record: FoodRecord) {
      const idx = foods.findIndex((x) => x.id === record.id);
      const next = idx >= 0 ? foods.map((x, i) => (i === idx ? record : x)) : [record, ...foods];
      setFoods(next);
      await commitRecords({ foods: next });
    }

    async function deleteFood(id: string) {
      const next = foods.filter((x) => x.id !== id);
      setFoods(next);
      await commitRecords({ foods: next });
    }

    async function saveMeasurement(record: BodyMeasurement) {
      const idx = measurements.findIndex((x) => x.id === record.id);
      const next = idx >= 0 ? measurements.map((x, i) => (i === idx ? record : x)) : [record, ...measurements];
      setMeasurements(next);
      await commitRecords({ measurements: next });
      // 一致性规则：最新一条带体重的测量 = 用户「当前体重」，同步写入个人资料（服务端），避免两处长期不一致。
      await syncProfileWeight(next);
    }

    /**
     * 把「最新一条体重测量」同步到个人资料（服务端 profile.weightKg）。
     * 规则：仅当最新测量的体重与当前资料体重不同时才写；写失败会抛错，由调用方提示用户。
     */
    async function syncProfileWeight(next: BodyMeasurement[]) {
      const token = session?.token;
      if (!token) return;
      const latest = next
        .filter((m) => m.weightKg != null)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
      if (!latest) return;
      const current = profile?.weightKg ?? null;
      if (latest.weightKg !== current) {
        const res = await api.updateMe(token, { weightKg: latest.weightKg });
        setSession((prev) => (prev ? { ...prev, user: res.user } : prev));
        await saveJSON(STORAGE_KEYS.session, { token, user: res.user });
      }
    }

    async function deleteMeasurement(id: string) {
      const next = measurements.filter((x) => x.id !== id);
      setMeasurements(next);
      await commitRecords({ measurements: next });
    }

    async function saveManualBurn(record: ManualBurn) {
      const idx = manualBurns.findIndex((x) => x.id === record.id);
      const next = idx >= 0 ? manualBurns.map((x, i) => (i === idx ? record : x)) : [record, ...manualBurns];
      setManualBurns(next);
      await commitRecords({ manualBurns: next });
    }

    async function deleteManualBurn(id: string) {
      const next = manualBurns.filter((x) => x.id !== id);
      setManualBurns(next);
      await commitRecords({ manualBurns: next });
    }

    async function seedSampleData() {
      const seed = buildSeedData();
      setWorkouts(seed.workouts);
      setFoods(seed.foods);
      setMeasurements(seed.measurements);
      setManualBurns(seed.manualBurns);
      await commitRecords({
        workouts: seed.workouts,
        foods: seed.foods,
        measurements: seed.measurements,
        manualBurns: seed.manualBurns,
      });
    }

    async function clearAll() {
      const token = session?.token;
      // 先清空服务器记录并注销会话（best-effort，失败不阻断本机清除）。
      if (token) {
        try {
          await api.deleteRecords(token);
        } catch {
          // 网络失败也继续本机清除
        }
        try {
          await api.logout(token);
        } catch {
          // 同上
        }
      }
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
