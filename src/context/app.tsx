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
} from '@/lib/types';
import { loadJSON, saveJSON, clearAllData, STORAGE_KEYS } from '@/lib/storage';
import { buildSeedData } from '@/lib/seed';
import { nowISO, uid } from '@/lib/util';

export interface AppState {
  ready: boolean;
  profile: UserProfile | null;
  workouts: WorkoutRecord[];
  foods: FoodRecord[];
  measurements: BodyMeasurement[];
  manualBurns: ManualBurn[];

  demoLogin: (phone: string | null) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;

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

function defaultProfile(phone: string | null): UserProfile {
  return {
    phone,
    nickname: 'FitLens 用户',
    avatarUri: null,
    goal: 'lose',
    targetKcal: null,
    heightCm: null,
    age: null,
    gender: null,
    isDemo: true,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [foods, setFoods] = useState<FoodRecord[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [manualBurns, setManualBurns] = useState<ManualBurn[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, w, f, m, b] = await Promise.all([
        loadJSON<UserProfile | null>(STORAGE_KEYS.profile, null),
        loadJSON<WorkoutRecord[]>(STORAGE_KEYS.workouts, []),
        loadJSON<FoodRecord[]>(STORAGE_KEYS.foods, []),
        loadJSON<BodyMeasurement[]>(STORAGE_KEYS.measurements, []),
        loadJSON<ManualBurn[]>(STORAGE_KEYS.manualBurns, []),
      ]);
      if (cancelled) return;
      setProfile(p);
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

  const api = useMemo<AppState>(() => {
    async function demoLogin(phone: string | null) {
      const p = defaultProfile(phone);
      setProfile(p);
      await saveJSON(STORAGE_KEYS.profile, p);
      const empty =
        workouts.length === 0 &&
        foods.length === 0 &&
        measurements.length === 0;
      if (empty) {
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
    }

    async function logout() {
      setProfile(null);
      await saveJSON(STORAGE_KEYS.profile, null);
    }

    async function updateProfile(patch: Partial<UserProfile>) {
      setProfile((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch, updatedAt: nowISO() };
        saveJSON(STORAGE_KEYS.profile, next);
        return next;
      });
    }

    async function saveWorkout(record: WorkoutRecord) {
      setWorkouts((prev) => {
        const idx = prev.findIndex((x) => x.id === record.id);
        const next =
          idx >= 0
            ? prev.map((x, i) => (i === idx ? record : x))
            : [record, ...prev];
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
        const next =
          idx >= 0
            ? prev.map((x, i) => (i === idx ? record : x))
            : [record, ...prev];
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
        const next =
          idx >= 0
            ? prev.map((x, i) => (i === idx ? record : x))
            : [record, ...prev];
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
        const next =
          idx >= 0
            ? prev.map((x, i) => (i === idx ? record : x))
            : [record, ...prev];
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
      setProfile(null);
      setWorkouts([]);
      setFoods([]);
      setMeasurements([]);
      setManualBurns([]);
      await clearAllData();
    }

    return {
      ready,
      profile,
      workouts,
      foods,
      measurements,
      manualBurns,
      demoLogin,
      logout,
      updateProfile,
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
  }, [ready, profile, workouts, foods, measurements, manualBurns]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用');
  return ctx;
}

export function makeRecordId(): string {
  return uid();
}
