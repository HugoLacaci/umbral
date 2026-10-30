/**
 * Generador de plan de estudio: semanas hasta el examen × destrezas más flojas.
 * Determinista (mismo día + mismo estado → mismo plan), para que las tareas del día se puedan marcar.
 */

export type Exam = 'toefl' | 'ielts';
export type Skill = 'reading' | 'listening' | 'writing' | 'speaking';
export const SKILLS: Skill[] = ['reading', 'listening', 'writing', 'speaking'];

export interface PlanTask {
  id: string;
  kind: 'vocab' | 'drill' | 'lesson' | 'practice' | 'mock' | 'review';
  skill?: Skill;
  title: { es: string; en: string };
  minutes: number;
  /** Ruta de la app (HashRouter). */
  to: string;
}

export interface PlanWeek {
  index: number;
  start: number;
  phase: 'foundation' | 'practice' | 'exam';
  goals: string[];
}

export interface PlanInput {
  exam: Exam;
  examDate: number;
  targets: Record<Skill, number>;
  current: Partial<Record<Skill, number>>;
  minutesPerDay: number;
  now?: number;
}

const DAY = 86_400_000;

const SKILL_ES: Record<Skill, string> = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' };

/** Banco de práctica recomendado por destreza (rutas de Practice). */
const PRACTICE: Record<Exam, Record<Skill, { bank: string; es: string; en: string }[]>> = {
  toefl: {
    reading: [
      { bank: 'toefl.ctw', es: 'Complete the Words', en: 'Complete the Words' },
      { bank: 'toefl.daily', es: 'Read in Daily Life', en: 'Read in Daily Life' },
      { bank: 'toefl.passage', es: 'Academic Passage', en: 'Academic Passage' },
    ],
    listening: [
      { bank: 'toefl.response', es: 'Choose a Response', en: 'Choose a Response' },
      { bank: 'toefl.conversation', es: 'Conversaciones', en: 'Conversations' },
      { bank: 'toefl.announcement', es: 'Anuncios', en: 'Announcements' },
      { bank: 'toefl.talk', es: 'Academic Talk', en: 'Academic Talk' },
    ],
    writing: [
      { bank: 'toefl.build', es: 'Build a Sentence', en: 'Build a Sentence' },
      { bank: 'toefl.email', es: 'Write an Email', en: 'Write an Email' },
      { bank: 'toefl.discussion', es: 'Academic Discussion', en: 'Academic Discussion' },
    ],
    speaking: [
      { bank: 'toefl.repeat', es: 'Listen and Repeat', en: 'Listen and Repeat' },
      { bank: 'toefl.interview', es: 'Take an Interview', en: 'Take an Interview' },
    ],
  },
  ielts: {
    reading: [{ bank: 'ielts.reading', es: 'Texto de Reading', en: 'Reading passage' }],
    listening: [{ bank: 'ielts.listening', es: 'Parte de Listening', en: 'Listening part' }],
    writing: [
      { bank: 'ielts.task1', es: 'Writing Task 1', en: 'Writing Task 1' },
      { bank: 'ielts.task2', es: 'Writing Task 2', en: 'Writing Task 2' },
    ],
    speaking: [
      { bank: 'ielts.p1', es: 'Speaking Part 1', en: 'Speaking Part 1' },
      { bank: 'ielts.p2', es: 'Speaking Part 2', en: 'Speaking Part 2' },
      { bank: 'ielts.p3', es: 'Speaking Part 3', en: 'Speaking Part 3' },
    ],
  },
};

const LESSONS: Record<Exam, Record<Skill, string[]>> = {
  toefl: {
    reading: ['toefl-reading-ctw', 'toefl-reading-daily', 'toefl-reading-academic'],
    listening: ['toefl-listening-response', 'toefl-listening-conversation', 'toefl-listening-announcement', 'toefl-listening-academic'],
    writing: ['toefl-writing-build', 'toefl-writing-email', 'toefl-writing-discussion', 'toefl-writing-rubric'],
    speaking: ['toefl-speaking-repeat', 'toefl-speaking-interview', 'toefl-speaking-rubric'],
  },
  ielts: {
    reading: ['ielts-reading-overview', 'ielts-reading-tfng', 'ielts-reading-headings', 'ielts-reading-matching', 'ielts-reading-completion'],
    listening: ['ielts-listening-overview', 'ielts-listening-completion', 'ielts-listening-maps', 'ielts-listening-matching'],
    writing: ['ielts-writing-task1-overview', 'ielts-writing-task2-overview', 'ielts-writing-task2-opinion', 'ielts-writing-rubric'],
    speaking: ['ielts-speaking-part1', 'ielts-speaking-part2', 'ielts-speaking-part3', 'ielts-speaking-rubric'],
  },
};

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayIndex(t: number) {
  return Math.floor((t - new Date(t).getTimezoneOffset() * 60_000) / DAY);
}

export function buildPlan(input: PlanInput): { weeks: PlanWeek[]; focus: Skill[]; today: PlanTask[]; phase: PlanWeek['phase']; daysLeft: number } {
  const now = input.now ?? Date.now();
  const daysLeft = Math.max(0, Math.ceil((input.examDate - now) / DAY));
  const nWeeks = Math.min(16, Math.max(1, Math.ceil(daysLeft / 7)));
  const step = input.exam === 'toefl' ? 0.5 : 0.5;

  const gap = (s: Skill) => input.targets[s] - (input.current[s] ?? input.targets[s] - step);
  const focus = [...SKILLS].sort((a, b) => gap(b) - gap(a) || SKILLS.indexOf(a) - SKILLS.indexOf(b));

  const examWeeks = nWeeks >= 4 ? 2 : 1;
  const foundationWeeks = nWeeks >= 6 ? Math.round(nWeeks * 0.35) : nWeeks >= 3 ? 1 : 0;
  const weeks: PlanWeek[] = Array.from({ length: nWeeks }, (_, i) => {
    const phase: PlanWeek['phase'] = i >= nWeeks - examWeeks ? 'exam' : i < foundationWeeks ? 'foundation' : 'practice';
    const main = focus[i % 2];
    const goals =
      phase === 'foundation'
        ? [`Estudia las guías de ${SKILL_ES[focus[0]]} y ${SKILL_ES[focus[1]]}`, 'Vocabulario AWL: 1 sublista', 'Gramática: 2 temas']
        : phase === 'practice'
          ? [`Práctica intensiva de ${SKILL_ES[main]}`, `Repasa tus tipos de pregunta más flojos`, 'Un simulacro por secciones el fin de semana']
          : ['Simulacro completo con tiempo real', 'Repasa errores del simulacro', 'Plantillas de Writing y Speaking de memoria'];
    return { index: i, start: now + i * 7 * DAY, phase, goals };
  });

  const phase = weeks[0].phase;
  const di = dayIndex(now);
  const key = dayKey(now);
  const budget = Math.max(15, input.minutesPerDay);
  const today: PlanTask[] = [];
  let used = 0;
  const push = (t: Omit<PlanTask, 'id'>) => {
    if (used + t.minutes > budget + 5) return;
    used += t.minutes;
    today.push({ ...t, id: `${key}-${today.length}-${t.kind}${t.skill ? '-' + t.skill : ''}` });
  };

  const weekday = new Date(now).getDay(); // 6 = sábado
  push({ kind: 'vocab', title: { es: 'Repaso de flashcards (SRS)', en: 'Flashcard review (SRS)' }, minutes: 10, to: '/study/vocab' });

  if (phase === 'exam' && (weekday === 6 || daysLeft <= 7) && budget >= 90) {
    push({ kind: 'mock', title: { es: 'Simulacro completo', en: 'Full mock test' }, minutes: input.exam === 'toefl' ? 90 : 165, to: '/exam' });
  }

  if (budget >= 40) push({ kind: 'drill', title: { es: 'Drill de gramática y vocabulario', en: 'Grammar & vocabulary drill' }, minutes: 8, to: '/practice/drills' });

  if (phase === 'foundation') {
    const s = focus[di % 2];
    const lessons = LESSONS[input.exam][s];
    push({ kind: 'lesson', skill: s, title: { es: `Lección de ${SKILL_ES[s]}`, en: `${SKILL_ES[s]} lesson` }, minutes: 15, to: `/study/lesson/${lessons[di % lessons.length]}` });
  }

  // Práctica de las dos destrezas prioritarias, alternando tipos de tarea
  for (const [k, s] of [focus[0], focus[1], focus[2]].entries()) {
    const opts = PRACTICE[input.exam][s];
    const p = opts[(di + k) % opts.length];
    const minutes = s === 'writing' ? (input.exam === 'ielts' ? 25 : 15) : s === 'speaking' ? 12 : 15;
    push({ kind: 'practice', skill: s, title: { es: `${SKILL_ES[s]}: ${p.es}`, en: `${SKILL_ES[s]}: ${p.en}` }, minutes, to: `/practice/${p.bank}` });
  }
  if (used < budget - 10) push({ kind: 'review', title: { es: 'Repasa tus errores', en: 'Review your mistakes' }, minutes: 10, to: '/history' });

  return { weeks, focus, today, phase, daysLeft };
}
