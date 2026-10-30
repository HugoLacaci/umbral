/**
 * Ensamblado de simulacros a partir de los bancos (usage = "mock") y cálculo de resultados.
 */
import { loadBank } from '@/content';
import type {
  IeltsListeningPart, IeltsReadingPassage, IeltsSpeakingP1, IeltsSpeakingP2, IeltsSpeakingP3, IeltsTask1, IeltsTask2,
  ToeflBuildItem, ToeflCtwSet, ToeflDiscussionTask, ToeflEmailTask, ToeflInterviewSet, ToeflListeningSet, ToeflReadingSet, ToeflRepeatSet,
} from '@/content/schema';
import type { Skill } from '@/engine/plan';
import type { Answers } from '@/components/questions/Items';
import type { AttemptItem } from '@/store';
import { objectiveItems } from '@/features/shared/objective';
import { toeflRLBand, routeModule, toeflWritingBand, toeflSpeakingBand, toeflOverall } from '@/engine/scoring/toefl';
import { ieltsListeningBand, ieltsReadingBand, ieltsWritingBand, ieltsOverall, ieltsRound } from '@/engine/scoring/ielts';
import { analyzeText, estimateIeltsWriting, estimateToeflWriting } from '@/engine/textAnalysis';
import { loadAwlSet } from '@/content';

export type Module = 'router' | 'lower' | 'upper';

/** Un set dentro de un módulo/sección, con su banco (para saber cómo pintarlo y corregirlo). */
export interface MockSet {
  bank: string;
  set: { id: string };
}

export interface ToeflMock {
  exam: 'toefl';
  no: number;
  reading: Record<Module, MockSet[]>;
  listening: Record<Module, MockSet[]>;
  build: ToeflBuildItem[];
  email: ToeflEmailTask;
  discussion: ToeflDiscussionTask;
  repeat: ToeflRepeatSet;
  interview: ToeflInterviewSet;
}

export interface IeltsMock {
  exam: 'ielts';
  no: number;
  listening: IeltsListeningPart[];
  reading: IeltsReadingPassage[];
  task1: IeltsTask1;
  task2: IeltsTask2;
  p1: IeltsSpeakingP1[];
  p2: IeltsSpeakingP2;
  p3: IeltsSpeakingP3;
}

export type Mock = ToeflMock | IeltsMock;

const num = (id: string) => Number(id.match(/(\d+)$/)?.[1] ?? 0);
const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id, 'en', { numeric: true });

export async function loadMock(exam: 'toefl' | 'ielts', no: number): Promise<Mock> {
  if (exam === 'toefl') {
    const [ctw, daily, passage, cr, conv, ann, talk, build, email, disc, rep, inter] = await Promise.all([
      loadBank('toefl.ctw'), loadBank('toefl.daily'), loadBank('toefl.passage'),
      loadBank('toefl.response'), loadBank('toefl.conversation'), loadBank('toefl.announcement'), loadBank('toefl.talk'),
      loadBank('toefl.build'), loadBank('toefl.email'), loadBank('toefl.discussion'), loadBank('toefl.repeat'), loadBank('toefl.interview'),
    ]);
    const pick = <T extends { mock?: number; module?: string; id: string }>(arr: T[], m: Module) => arr.filter((x) => x.mock === no && x.module === m).sort(byId);
    const mod = (m: Module) => ({
      reading: [
        ...pick(ctw as (ToeflCtwSet & { module?: string })[], m).map((set) => ({ bank: 'toefl.ctw', set })),
        ...pick(daily as ToeflReadingSet[], m).map((set) => ({ bank: 'toefl.daily', set })),
        ...pick(passage as ToeflReadingSet[], m).map((set) => ({ bank: 'toefl.passage', set })),
      ],
      listening: [
        ...(pick(cr as ToeflListeningSet[], m).sort((a, b) => num(a.id) - num(b.id)).map((set) => ({ bank: 'toefl.response', set }))),
        ...pick(conv as ToeflListeningSet[], m).map((set) => ({ bank: 'toefl.conversation', set })),
        ...pick(ann as ToeflListeningSet[], m).map((set) => ({ bank: 'toefl.announcement', set })),
        ...pick(talk as ToeflListeningSet[], m).map((set) => ({ bank: 'toefl.talk', set })),
      ],
    });
    const r = mod('router');
    const lo = mod('lower');
    const up = mod('upper');
    const one = <T extends { mock?: number; usage: string }>(arr: T[]) => arr.find((x) => x.usage === 'mock' && x.mock === no)!;
    return {
      exam: 'toefl',
      no,
      reading: { router: r.reading, lower: lo.reading, upper: up.reading },
      listening: { router: r.listening, lower: lo.listening, upper: up.listening },
      build: (build as ToeflBuildItem[]).filter((b) => b.usage === 'mock' && b.mock === no).sort((a, b) => num(a.id) - num(b.id)),
      email: one(email as ToeflEmailTask[]),
      discussion: one(disc as ToeflDiscussionTask[]),
      repeat: one(rep as ToeflRepeatSet[]),
      interview: one(inter as ToeflInterviewSet[]),
    };
  }
  const [lis, rea, t1, t2, p1, p2, p3] = await Promise.all([
    loadBank('ielts.listening'), loadBank('ielts.reading'), loadBank('ielts.task1'), loadBank('ielts.task2'), loadBank('ielts.p1'), loadBank('ielts.p2'), loadBank('ielts.p3'),
  ]);
  const m = <T extends { usage: string; mock?: number }>(arr: T[]) => arr.filter((x) => x.usage === 'mock' && x.mock === no);
  return {
    exam: 'ielts',
    no,
    listening: m(lis).sort((a, b) => a.part - b.part),
    reading: m(rea).sort((a, b) => a.passageNo - b.passageNo),
    task1: m(t1)[0],
    task2: m(t2)[0],
    p1: m(p1).sort(byId),
    p2: m(p2)[0],
    p3: m(p3)[0],
  };
}

export function mockIsComplete(m: Mock): boolean {
  if (m.exam === 'toefl')
    return !!(m.reading.router.length && m.reading.lower.length && m.reading.upper.length && m.listening.router.length && m.listening.lower.length && m.listening.upper.length && m.build.length && m.email && m.discussion && m.repeat && m.interview);
  return m.listening.length === 4 && m.reading.length === 3 && !!m.task1 && !!m.task2 && m.p1.length > 0 && !!m.p2 && !!m.p3;
}

/* ─────────── Estado de una sesión de examen ─────────── */

export type Scope = 'full' | Skill;

export interface SpeakingSaved {
  kind: string;
  itemScores?: number[];
  band?: number;
  responses: { prompt: string; transcript: string; durationSec: number; wpm: number; accuracy?: number; score?: number }[];
}

export interface ExamState {
  version: 1;
  exam: 'toefl' | 'ielts';
  mock: number;
  scope: Scope;
  flexible: boolean;
  startedAt: number;
  sections: Skill[];
  sectionIdx: number;
  /** Paso dentro de la sección. */
  step: number;
  /** Fin del temporizador vigente (ms epoch). */
  endsAt: number | null;
  /** Segundos que quedaban al pausar (modo flexible). */
  pausedLeft: number | null;
  phase: 'intro' | 'run' | 'transition' | 'review';
  /** Ruta adaptativa TOEFL. */
  path: Partial<Record<'reading' | 'listening', 'lower' | 'upper'>>;
  module: Partial<Record<'reading' | 'listening', Module>>;
  /** Respuestas: `${setId}::${itemId}` → respuesta. */
  answers: Answers;
  texts: Record<string, string>;
  speaking: SpeakingSaved[];
  /** Segundos por set. */
  timings: Record<string, number>;
  flags: string[];
  pauses: number;
}

export function scopedAnswers(all: Answers, setId: string): Answers {
  const out: Answers = {};
  const p = `${setId}::`;
  for (const k in all) if (k.startsWith(p)) out[k.slice(p.length)] = all[k];
  return out;
}

/* ─────────── Resultados ─────────── */

export interface MockResult {
  items: AttemptItem[];
  bands: Partial<Record<Skill, number>>;
  overall?: number;
  detail: Record<string, unknown>;
}

function objective(sets: MockSet[], answers: Answers): AttemptItem[] {
  return sets.flatMap(({ bank, set }) => objectiveItems(bank, set, scopedAnswers(answers, set.id)).map((i) => ({ ...i, qid: i.qid.includes('#') ? i.qid : `${set.id}#${i.qid}` })));
}

export async function scoreMock(mock: Mock, st: ExamState): Promise<MockResult> {
  const awl = await loadAwlSet();
  const items: AttemptItem[] = [];
  const bands: Partial<Record<Skill, number>> = {};
  const detail: Record<string, unknown> = { path: st.path, timings: st.timings, flexible: st.flexible, pauses: st.pauses, texts: st.texts, speaking: st.speaking, answers: st.answers };

  if (mock.exam === 'toefl') {
    for (const sec of ['reading', 'listening'] as const) {
      if (!st.sections.includes(sec)) continue;
      const path = st.path[sec] ?? 'lower';
      const its = objective([...mock[sec].router, ...mock[sec][path]], st.answers);
      items.push(...its);
      const e = its.reduce((s, i) => s + i.earned, 0);
      const m = its.reduce((s, i) => s + i.max, 0);
      bands[sec] = toeflRLBand(m ? e / m : 0, path);
    }
    if (st.sections.includes('writing')) {
      const b = objective(mock.build.map((set) => ({ bank: 'toefl.build', set })), st.answers);
      items.push(...b);
      const email = estimateToeflWriting(analyzeText(st.texts.email ?? '', awl), { task: 'email' }).score;
      const disc = estimateToeflWriting(analyzeText(st.texts.discussion ?? '', awl), { task: 'discussion' }).score;
      const es = (st.texts.email ?? '').trim().split(/\s+/).length < 15 ? 0 : email;
      const ds = (st.texts.discussion ?? '').trim().split(/\s+/).length < 15 ? 0 : disc;
      items.push({ qid: mock.email.id, qtype: 'toefl.email', section: 'writing', earned: es, max: 5, correct: es >= 4 });
      items.push({ qid: mock.discussion.id, qtype: 'toefl.discussion', section: 'writing', earned: ds, max: 5, correct: ds >= 4 });
      bands.writing = toeflWritingBand(b.filter((i) => i.correct).length, b.length, es, ds);
      detail.writingScores = { email: es, discussion: ds };
    }
    if (st.sections.includes('speaking')) {
      const rep = st.speaking.find((s) => s.kind === 'toefl.repeat')?.itemScores ?? Array(7).fill(0);
      const int = st.speaking.find((s) => s.kind === 'toefl.interview')?.itemScores ?? Array(4).fill(0);
      rep.forEach((s, i) => items.push({ qid: `${mock.repeat.id}#${i}`, qtype: 'toefl.repeat', section: 'speaking', earned: s, max: 5, correct: s >= 4 }));
      int.forEach((s, i) => items.push({ qid: `${mock.interview.id}#${i}`, qtype: 'toefl.interview', section: 'speaking', earned: s, max: 5, correct: s >= 4 }));
      bands.speaking = toeflSpeakingBand(rep, int);
    }
    const vals = st.sections.map((s) => bands[s]).filter((x): x is number => x !== undefined);
    return { items, bands, overall: vals.length === 4 ? toeflOverall(vals) : undefined, detail };
  }

  // IELTS
  if (st.sections.includes('listening')) {
    const its = objective(mock.listening.map((set) => ({ bank: 'ielts.listening', set })), st.answers);
    items.push(...its);
    const raw = its.reduce((s, i) => s + i.earned, 0);
    const max = its.reduce((s, i) => s + i.max, 0);
    bands.listening = ieltsListeningBand(Math.round((raw / Math.max(1, max)) * 40));
    detail.listeningRaw = `${raw}/${max}`;
  }
  if (st.sections.includes('reading')) {
    const its = objective(mock.reading.map((set) => ({ bank: 'ielts.reading', set })), st.answers);
    items.push(...its);
    const raw = its.reduce((s, i) => s + i.earned, 0);
    const max = its.reduce((s, i) => s + i.max, 0);
    bands.reading = ieltsReadingBand(Math.round((raw / Math.max(1, max)) * 40));
    detail.readingRaw = `${raw}/${max}`;
  }
  if (st.sections.includes('writing')) {
    const t1 = estimateIeltsWriting(analyzeText(st.texts.task1 ?? '', awl), { task: 1 });
    const t2 = estimateIeltsWriting(analyzeText(st.texts.task2 ?? '', awl), { task: 2 });
    const b1 = (st.texts.task1 ?? '').trim().length < 40 ? 0 : t1.band;
    const b2 = (st.texts.task2 ?? '').trim().length < 60 ? 0 : t2.band;
    items.push({ qid: mock.task1.id, qtype: 'ielts.task1', section: 'writing', earned: b1, max: 9, correct: b1 >= 7 });
    items.push({ qid: mock.task2.id, qtype: 'ielts.task2', section: 'writing', earned: b2, max: 9, correct: b2 >= 7 });
    bands.writing = ieltsWritingBand(b1, b2);
    detail.writingScores = { task1: b1, task2: b2, criteria1: t1.criteria, criteria2: t2.criteria };
  }
  if (st.sections.includes('speaking')) {
    const bs = st.speaking.map((s) => s.band ?? 0);
    bands.speaking = bs.length ? ieltsRound(bs.reduce((a, b) => a + b, 0) / bs.length) : 0;
    items.push({ qid: `speaking-${mock.no}`, qtype: 'ielts.speaking', section: 'speaking', earned: bands.speaking, max: 9, correct: bands.speaking >= 7 });
  }
  const vals = st.sections.map((s) => bands[s]).filter((x): x is number => x !== undefined);
  return { items, bands, overall: vals.length === 4 ? ieltsOverall(vals) : undefined, detail };
}

/** Recalcula la nota del router TOEFL para decidir el módulo 2. */
export function routerDecision(sets: MockSet[], answers: Answers): { module: 'lower' | 'upper'; correct: number; total: number } {
  const its = objective(sets, answers);
  const c = its.reduce((s, i) => s + i.earned, 0);
  const t = its.reduce((s, i) => s + i.max, 0);
  return { module: routeModule(c, t), correct: c, total: t };
}

/* ─────────── Tiempos oficiales/aproximados (s) ─────────── */

export const TOEFL_TIME = {
  reading: { router: 18 * 60, lower: 9 * 60, upper: 9 * 60 },
  listening: { router: 18 * 60, lower: 7 * 60, upper: 11 * 60 },
  writing: { build: 6 * 60, email: 7 * 60, discussion: 10 * 60 },
};
export const IELTS_TIME = { readingLead: 30, listeningReview: 120, reading: 60 * 60, writing: 60 * 60, partGap: 30 };
