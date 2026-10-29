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
  type Gender,
  type Goal,
} from '@/lib/types';
import { loadJSON, saveJSON, clearAllData, STORAGE_KEYS } from '@/lib/storage';
import { buildSeedData } from '@/lib/seed';
import { uid } from '@/lib/util';
import { api, type ServerUser } from '@/services/api';

export interface Session {
  token: string;
  user: ServerUser;
}

export interface Prefs {
  goal: Goal;
  targetKcal: number | null;
  heightCm: number | null;
  age: number | null;
  gender: Gender;
  avatarUri: string | null;
}

const DEFAULT_PREFS: Prefs = {
  goal: 'lose',
  targetKcal: null,
  heightCm: null,
  age: null,
  gender: null,
  avatarUri: null,
};

export interface AppState {
  ready: boolean;
  session: Session | null;
  prefs: Prefs;
  profile: UserProfile | null; // 由 session + prefs 派生的视图对象
  workouts: WorkoutRecord[];
  foods: FoodRecord[];
  measurements: BodyMeasurement[];
  manualBurns: ManualBurn[];

  login: (email: string, password: string, captchaId: string, captchaInput: string) => Promise<void>;
  register: (email: string, password: string, nickname: string, captchaId: string, captchaInput: string) => Promise<void>;
  logout: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updatePrefs: (patch: Partial<Prefs>) => Promise<void>;

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
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [foods, setFoods] = useState<FoodRecord[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [manualBurns, setManualBurns] = useState<ManualBurn[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, p, w, f, m, b] = await Promise.all([
        loadJSON<Session | null>(STORAGE_KEYS.session, null),
        loadJSON<Prefs>(STORAGE_KEYS.prefs, DEFAULT_PREFS),
        loadJSON<WorkoutRecord[]>(STORAGE_KEYS.workouts, []),
        loadJSON<FoodRecord[]>(STORAGE_KEYS.foods, []),
        loadJSON<BodyMeasurement[]>(STORAGE_KEYS.measurements, []),
        loadJSON<ManualBurn[]>(STORAGE_KEYS.manualBurns, []),
      ]);
      if (cancelled) return;
      setSession(s);
      setPrefs({ ...DEFAULT_PREFS, ...p });
      setWorkouts(w);
      setFoods(f);
      setMeasurements(m);
      setManualBurns(b);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = useMemo<UserProfile | null>(() => {
    if (!session) return null;
    return {
      email: session.user.email,
      nickname: session.user.nickname,
      avatarUri: prefs.avatarUri,
      goal: prefs.goal,
      targetKcal: prefs.targetKcal,
      heightCm: prefs.heightCm,
      age: prefs.age,
      gender: prefs.gender,
    };
  }, [session, prefs]);

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

    async function updatePrefs(patch: Partial<Prefs>) {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        saveJSON(STORAGE_KEYS.prefs, next);
        return next;
      });
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
      setPrefs(DEFAULT_PREFS);
      setWorkouts([]);
      setFoods([]);
      setMeasurements([]);
      setManualBurns([]);
      await clearAllData();
    }

    return {
      ready,
      session,
      prefs,
      profile,
      workouts,
      foods,
      measurements,
      manualBurns,
      login,
      register,
      logout,
      updateNickname,
      updatePrefs,
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
  }, [ready, session, prefs, profile, workouts, foods, measurements, manualBurns]);

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
