/** Repetición espaciada SM-2 (Wozniak, 1990) con los botones habituales Otra vez / Difícil / Bien / Fácil. */

export interface SrsState {
  /** Easiness factor (≥ 1.3). */
  ef: number;
  /** Intervalo actual en días. */
  interval: number;
  /** Repeticiones correctas seguidas. */
  reps: number;
  lapses: number;
  /** Fecha de próximo repaso (ms epoch). */
  due: number;
  last?: number;
}

export type Grade = 'again' | 'hard' | 'good' | 'easy';
export const GRADE_QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

const DAY = 86_400_000;

export function newCard(now = Date.now()): SrsState {
  return { ef: 2.5, interval: 0, reps: 0, lapses: 0, due: now };
}

/** Aplica una respuesta de calidad q (0–5) según SM-2. */
export function review(state: SrsState, grade: Grade, now = Date.now()): SrsState {
  const q = GRADE_QUALITY[grade];
  let { ef, interval, reps, lapses } = state;
  if (q < 3) {
    reps = 0;
    interval = 0; // vuelve hoy (en ~10 min)
    lapses += 1;
  } else {
    reps += 1;
    if (reps === 1) interval = grade === 'easy' ? 3 : 1;
    else if (reps === 2) interval = grade === 'hard' ? 3 : 6;
    else interval = Math.round(interval * ef * (grade === 'hard' ? 0.8 : grade === 'easy' ? 1.3 : 1));
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const due = interval === 0 ? now + 10 * 60_000 : startOfDay(now) + interval * DAY;
  return { ef: round2(ef), interval, reps, lapses, due, last: now };
}

export function isDue(s: SrsState | undefined, now = Date.now()): boolean {
  return !s || s.due <= now;
}

/** Texto del próximo intervalo para el botón ("10 min", "1 d", "6 d"). */
export function previewInterval(state: SrsState, grade: Grade, now = Date.now()): string {
  const n = review(state, grade, now);
  if (n.interval === 0) return '10 min';
  if (n.interval < 30) return `${n.interval} d`;
  if (n.interval < 365) return `${Math.round(n.interval / 30)} m`;
  return `${(n.interval / 365).toFixed(1)} a`;
}

/** Estado de dominio para mostrar en listas. */
export function mastery(s: SrsState | undefined): 'new' | 'learning' | 'young' | 'mature' {
  if (!s || (s.reps === 0 && !s.last)) return 'new';
  if (s.interval < 1) return 'learning';
  if (s.interval < 21) return 'young';
  return 'mature';
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(4, 0, 0, 0); // el "día" cambia a las 4:00 (como Anki)
  return d.getTime();
}
const round2 = (x: number) => Math.round(x * 100) / 100;
