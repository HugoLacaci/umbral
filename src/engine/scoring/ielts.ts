/**
 * Puntuación IELTS Academic. Fuentes y tablas: docs/FORMATOS.md.
 * Oficial: bandas 0–9 en medias bandas; global con redondeo .25 → .5 y .75 → entera siguiente;
 * Writing: Task 2 pesa el doble; 4 criterios con el mismo peso.
 * Aproximado: tablas aciertos/40 → banda (IELTS sólo publica puntos de anclaje).
 */

export type IeltsSection = 'listening' | 'reading' | 'writing' | 'speaking';
export const IELTS_SECTIONS: IeltsSection[] = ['listening', 'reading', 'writing', 'speaking'];

/** [mínimo de aciertos, banda] en orden descendente. */
const LISTENING: [number, number][] = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [3, 2], [2, 1.5], [1, 1],
];
const ACADEMIC_READING: [number, number][] = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [3, 2], [2, 1.5], [1, 1],
];

function lookup(table: [number, number][], raw: number): number {
  for (const [min, band] of table) if (raw >= min) return band;
  return 0;
}

export function ieltsListeningBand(raw: number): number {
  return lookup(LISTENING, Math.round(raw));
}
export function ieltsReadingBand(raw: number): number {
  return lookup(ACADEMIC_READING, Math.round(raw));
}

/** Aciertos mínimos para una banda (para mostrar «te faltan N aciertos»). */
export function rawNeeded(section: 'listening' | 'reading', band: number): number {
  const table = section === 'listening' ? LISTENING : ACADEMIC_READING;
  const row = [...table].reverse().find(([, b]) => b >= band);
  return row ? row[0] : 40;
}

/**
 * Redondeo oficial a media banda: fracción < .25 → baja; .25 ≤ f < .75 → .5; ≥ .75 → entera siguiente.
 * 6.125 → 6 · 6.25 → 6.5 · 6.625 → 6.5 · 6.75 → 7
 */
export function ieltsRound(avg: number): number {
  const fl = Math.floor(avg + 1e-9);
  const f = avg - fl;
  if (f < 0.25 - 1e-9) return fl;
  if (f < 0.75 - 1e-9) return fl + 0.5;
  return fl + 1;
}

export function ieltsOverall(sections: number[]): number {
  if (!sections.length) return 0;
  return ieltsRound(sections.reduce((a, b) => a + b, 0) / sections.length);
}

/** Banda de una tarea de Writing = media de los 4 criterios (cada criterio en bandas enteras o medias). */
export function criteriaAverage(criteria: number[]): number {
  return criteria.reduce((a, b) => a + b, 0) / criteria.length;
}

/** Writing: Task 2 cuenta el doble que Task 1. Se redondea con la misma regla de media banda. */
export function ieltsWritingBand(task1: number, task2: number): number {
  return ieltsRound((task1 + 2 * task2) / 3);
}

/** Speaking: media de los 4 criterios con redondeo a media banda. */
export function ieltsSpeakingBand(criteria: number[]): number {
  return ieltsRound(criteriaAverage(criteria));
}

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
/** Correspondencia IELTS ↔ MCER publicada por IELTS (orientativa). */
export function ieltsCefr(band: number): Cefr | 'A1' {
  if (band >= 8.5) return 'C2';
  if (band >= 7) return 'C1';
  if (band >= 5.5) return 'B2';
  if (band >= 4) return 'B1';
  if (band >= 3) return 'A2';
  return 'A1';
}

export const fmtBand = (b: number) => b.toFixed(1);
