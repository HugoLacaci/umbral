/**
 * Estado de Umbral.
 *  - useUi: preferencias ligeras en localStorage (tema, idioma, examen activo) → se leen antes de pintar.
 *  - useApp: perfil y progreso en IndexedDB (sin servidor). Exportable/importable en JSON.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb';
import { newCard, review, type Grade, type SrsState } from '@/engine/srs';
import { dayKey, type Exam, type Skill } from '@/engine/plan';
import { uid } from '@/lib/cn';

/* ─────────── UI ─────────── */

export type Lang = 'es' | 'en';
export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  exam: Exam;
  lang: Lang;
  theme: Theme;
  setExam: (e: Exam) => void;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      exam: 'toefl',
      lang: 'es',
      theme: 'system',
      setExam: (exam) => set({ exam }),
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'umbral-ui' },
  ),
);

/* ─────────── Datos ─────────── */

export interface ExamProfile {
  targets: Record<Skill, number>;
  overallTarget: number;
  examDate: number | null;
  /** Requisitos con nombre para comparar (SJTU, KAIST…). */
  requirements: Requirement[];
}

export interface Requirement {
  id: string;
  name: string;
  overall: number;
  sections: Partial<Record<Skill, number>>;
}

export interface AttemptItem {
  qid: string;
  qtype: string;
  section: Skill;
  earned: number;
  max: number;
  correct: boolean;
  timeSec?: number;
  response?: unknown;
}

export interface Attempt {
  id: string;
  exam: Exam;
  kind: 'practice' | 'mock';
  /** practice: banco y set; mock: nº de simulacro y secciones incluidas. */
  bank?: string;
  setId?: string;
  title: string;
  mockNo?: number;
  sections: Skill[];
  startedAt: number;
  finishedAt: number;
  durationSec: number;
  flexible?: boolean;
  items: AttemptItem[];
  /** Banda (estimada) por destreza y global. */
  bands?: Partial<Record<Skill, number>>;
  overall?: number;
  /** Datos para rehacer el informe (texto escrito, transcripciones, rutas adaptativas…). */
  detail?: Record<string, unknown>;
}

export const TOEFL_PRESETS: Requirement[] = [
  { id: 'sjtu', name: 'SJTU (máster)', overall: 4, sections: { reading: 4, listening: 4.5, speaking: 4, writing: 4.5 } },
  { id: 'kaist', name: 'KAIST', overall: 4.5, sections: {} },
];
export const IELTS_PRESETS: Requirement[] = [
  { id: 'ielts-7', name: '7.0 (mín. 6.0)', overall: 7, sections: { listening: 6, reading: 6, writing: 6, speaking: 6 } },
];

const defaultProfiles: Record<Exam, ExamProfile> = {
  toefl: {
    targets: { reading: 4, listening: 4.5, writing: 4.5, speaking: 4 },
    overallTarget: 4.5,
    examDate: null,
    requirements: TOEFL_PRESETS,
  },
  ielts: {
    targets: { reading: 7, listening: 7, writing: 6.5, speaking: 6.5 },
    overallTarget: 7,
    examDate: null,
    requirements: IELTS_PRESETS,
  },
};

interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  name: string;
  minutesPerDay: number;
  profiles: Record<Exam, ExamProfile>;
  geminiKey: string;
  /** Minutos de estudio por día (YYYY-MM-DD). */
  activity: Record<string, number>;
  xp: number;
  attempts: Attempt[];
  srs: Record<string, SrsState>;
  studied: string[];
  bookmarks: string[];
  videosWatched: string[];
  videoNotes: Record<string, string>;
  /** Tareas del plan marcadas: dayKey → ids. */
  tasksDone: Record<string, string[]>;
  /** Borradores y sesiones en curso (autoguardado). */
  drafts: Record<string, unknown>;
  seenAchievements: string[];

  set: (p: Partial<AppState>) => void;
  updateProfile: (exam: Exam, p: Partial<ExamProfile>) => void;
  addMinutes: (n: number) => void;
  addXp: (n: number) => void;
  saveAttempt: (a: Omit<Attempt, 'id'> & { id?: string }) => string;
  deleteAttempt: (id: string) => void;
  reviewCard: (cardId: string, g: Grade) => void;
  toggle: (key: 'studied' | 'bookmarks' | 'videosWatched', id: string) => void;
  toggleTask: (taskId: string) => void;
  saveDraft: (key: string, v: unknown) => void;
  clearDraft: (key: string) => void;
  importData: (json: string) => void;
  exportData: () => string;
  reset: () => void;
}

const initial = {
  onboarded: false,
  name: '',
  minutesPerDay: 60,
  profiles: defaultProfiles,
  geminiKey: '',
  activity: {},
  xp: 0,
  attempts: [],
  srs: {},
  studied: [],
  bookmarks: [],
  videosWatched: [],
  videoNotes: {},
  tasksDone: {},
  drafts: {},
  seenAchievements: [],
};

const PERSIST_KEYS = Object.keys(initial) as (keyof typeof initial)[];

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial,
      hydrated: false,
      set: (p) => set(p),
      updateProfile: (exam, p) => set((s) => ({ profiles: { ...s.profiles, [exam]: { ...s.profiles[exam], ...p } } })),
      addMinutes: (n) =>
        set((s) => {
          const k = dayKey(Date.now());
          return { activity: { ...s.activity, [k]: (s.activity[k] ?? 0) + n }, xp: s.xp + n * 2 };
        }),
      addXp: (n) => set((s) => ({ xp: s.xp + n })),
      saveAttempt: (a) => {
        const id = a.id ?? uid();
        const correct = a.items.filter((i) => i.correct).length;
        set((s) => ({ attempts: [...s.attempts.filter((x) => x.id !== id), { ...a, id }], xp: s.xp + 10 + correct * 2 }));
        return id;
      },
      deleteAttempt: (id) => set((s) => ({ attempts: s.attempts.filter((a) => a.id !== id) })),
      reviewCard: (cardId, g) =>
        set((s) => ({ srs: { ...s.srs, [cardId]: review(s.srs[cardId] ?? newCard(), g) }, xp: s.xp + 1 })),
      toggle: (key, id) =>
        set((s) => {
          const list = s[key];
          return { [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] } as Partial<AppState>;
        }),
      toggleTask: (taskId) =>
        set((s) => {
          const k = dayKey(Date.now());
          const list = s.tasksDone[k] ?? [];
          const has = list.includes(taskId);
          return {
            tasksDone: { ...s.tasksDone, [k]: has ? list.filter((x) => x !== taskId) : [...list, taskId] },
            xp: s.xp + (has ? -5 : 5),
          };
        }),
      saveDraft: (key, v) => set((s) => ({ drafts: { ...s.drafts, [key]: v } })),
      clearDraft: (key) =>
        set((s) => {
          const d = { ...s.drafts };
          delete d[key];
          return { drafts: d };
        }),
      exportData: () => {
        const s = get();
        const data: Record<string, unknown> = { app: 'umbral', version: 1, exportedAt: new Date().toISOString() };
        for (const k of PERSIST_KEYS) if (k !== 'geminiKey') data[k] = s[k];
        return JSON.stringify(data, null, 2);
      },
      importData: (json) => {
        const data = JSON.parse(json);
        if (data.app !== 'umbral') throw new Error('No es un archivo de progreso de Umbral');
        const patch: Record<string, unknown> = {};
        for (const k of PERSIST_KEYS) if (k in data && k !== 'geminiKey') patch[k] = data[k];
        set(patch as Partial<AppState>);
      },
      reset: () => set({ ...initial }),
    }),
    {
      name: 'umbral-data',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => Object.fromEntries(PERSIST_KEYS.map((k) => [k, s[k]])) as Partial<AppState>,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          profiles: {
            toefl: { ...defaultProfiles.toefl, ...p.profiles?.toefl },
            ielts: { ...defaultProfiles.ielts, ...p.profiles?.ielts },
          },
        };
      },
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

/* ─────────── Selectores derivados ─────────── */

export function streak(activity: Record<string, number>, now = Date.now()): number {
  let n = 0;
  let t = now;
  // Si hoy aún no has estudiado, la racha cuenta hasta ayer.
  if (!activity[dayKey(t)]) t -= 86_400_000;
  while (activity[dayKey(t)]) {
    n++;
    t -= 86_400_000;
  }
  return n;
}

export function totalMinutes(activity: Record<string, number>): number {
  return Object.values(activity).reduce((a, b) => a + b, 0);
}

/** Estadísticas por tipo de pregunta (para "fallas el 40 % de los Not Given"). */
export function qtypeStats(attempts: Attempt[], exam: Exam) {
  const map = new Map<string, { seen: number; correct: number; section: Skill }>();
  for (const a of attempts) {
    if (a.exam !== exam) continue;
    for (const it of a.items) {
      const k = it.qtype === 'judge' ? 'tfng' : it.qtype;
      const e = map.get(k) ?? { seen: 0, correct: 0, section: it.section };
      e.seen += it.max;
      e.correct += it.earned;
      map.set(k, e);
    }
  }
  return [...map.entries()].map(([qtype, v]) => ({ qtype, ...v, rate: v.seen ? v.correct / v.seen : 0 }));
}

/** Nota estimada actual por destreza: media ponderada de los últimos intentos (más peso a simulacros). */
export function currentEstimates(attempts: Attempt[], exam: Exam): Partial<Record<Skill, number>> {
  const out: Partial<Record<Skill, number>> = {};
  for (const s of ['reading', 'listening', 'writing', 'speaking'] as Skill[]) {
    const rel = attempts
      .filter((a) => a.exam === exam && a.bands?.[s] !== undefined)
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, 6);
    if (!rel.length) continue;
    let w = 0;
    let sum = 0;
    rel.forEach((a, i) => {
      const weight = (a.kind === 'mock' ? 3 : 1) / (1 + i * 0.3);
      w += weight;
      sum += a.bands![s]! * weight;
    });
    out[s] = Math.round((sum / w) * 2) / 2;
  }
  return out;
}
