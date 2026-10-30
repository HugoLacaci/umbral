/**
 * Puntuación TOEFL iBT (formato 2026). Fuentes y tablas: docs/FORMATOS.md.
 * Lo oficial: escala 1–6 (0,5), global = media redondeada al 0,5 más cercano, MCER y tabla 0–120.
 * Lo estimado (ETS no publica la conversión): aciertos/puntos brutos → banda de sección.
 */

export type ToeflSection = 'reading' | 'listening' | 'writing' | 'speaking';
export const TOEFL_SECTIONS: ToeflSection[] = ['reading', 'listening', 'writing', 'speaking'];

export const TOEFL_BANDS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6] as const;

/** Media de las 4 secciones redondeada al 0,5 más cercano (5,125 → 5; 5,25 → 5,5). */
export function toeflOverall(sections: number[]): number {
  if (sections.length === 0) return 0;
  const avg = sections.reduce((a, b) => a + b, 0) / sections.length;
  // ε para evitar errores de coma flotante en casos frontera (x,25 / x,75)
  return clampBand(Math.round(avg * 2 + 1e-9) / 2);
}

export function clampBand(b: number): number {
  return Math.min(6, Math.max(1, b));
}

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** MCER (informe técnico ETS 2026, tabla 7). */
export function toeflCefr(band: number): Cefr {
  if (band >= 6) return 'C2';
  if (band >= 5) return 'C1';
  if (band >= 4) return 'B2';
  if (band >= 3) return 'B1';
  if (band >= 2) return 'A2';
  return 'A1';
}

/** Tabla 6 del informe técnico: total 0–120 comparable por banda global. */
const COMPARABLE_MIN: Record<string, number> = {
  '6': 114, '5.5': 107, '5': 95, '4.5': 86, '4': 72, '3.5': 58, '3': 44, '2.5': 34, '2': 24, '1.5': 12, '1': 0,
};

export function toeflComparable(band: number): { min: number; max: number; label: string } {
  const b = clampBand(Math.round(band * 2) / 2);
  const min = COMPARABLE_MIN[String(b)];
  const next = COMPARABLE_MIN[String(b + 0.5)];
  const max = b >= 6 ? 120 : next - 1;
  return { min, max, label: b >= 6 ? '114–120' : `${min}–${max}` };
}

/** Rango 0–30 por sección (tabla 6), por si se quiere mostrar. */
export const SECTION_0_30: Record<ToeflSection, Record<string, string>> = {
  reading: { '6': '29–30', '5.5': '27–28', '5': '24–26', '4.5': '22–23', '4': '18–21', '3.5': '12–17', '3': '6–11', '2.5': '4–5', '2': '3', '1.5': '2', '1': '0–1' },
  listening: { '6': '28–30', '5.5': '26–27', '5': '22–25', '4.5': '20–21', '4': '17–19', '3.5': '13–16', '3': '9–12', '2.5': '6–8', '2': '4–5', '1.5': '2–3', '1': '0–1' },
  writing: { '6': '29–30', '5.5': '27–28', '5': '24–26', '4.5': '21–23', '4': '17–20', '3.5': '15–16', '3': '13–14', '2.5': '11–12', '2': '7–10', '1.5': '3–6', '1': '0–2' },
  speaking: { '6': '28–30', '5.5': '27', '5': '25–26', '4.5': '23–24', '4': '20–22', '3.5': '18–19', '3': '16–17', '2.5': '13–15', '2': '10–12', '1.5': '5–9', '1': '0–4' },
};

/** Tabla B1 del informe técnico ETS: banda IELTS → banda TOEFL global. */
export const IELTS_TO_TOEFL: Record<string, number> = {
  '9': 6, '8.5': 6, '8': 6, '7.5': 5.5, '7': 5, '6.5': 4.5, '6': 4, '5.5': 3.5, '5': 2.5, '4.5': 2, '4': 1.5,
};

/* ─────────── Estimaciones de banda por sección (NO oficiales) ─────────── */

/**
 * Reading / Listening con adaptatividad en dos etapas.
 * El módulo 2 «lower» limita la banda máxima (como en un MST real) y el «upper» parte de un suelo más alto.
 * `p` = proporción de aciertos en router + módulo 2.
 */
export function toeflRLBand(p: number, path: 'lower' | 'upper'): number {
  const x = Math.max(0, Math.min(1, p));
  const upper: [number, number][] = [
    [0.95, 6], [0.88, 5.5], [0.8, 5], [0.7, 4.5], [0.6, 4], [0.48, 3.5], [0, 3],
  ];
  const lower: [number, number][] = [
    [0.9, 4.5], [0.8, 4], [0.68, 3.5], [0.55, 3], [0.42, 2.5], [0.3, 2], [0.18, 1.5], [0, 1],
  ];
  for (const [min, band] of path === 'upper' ? upper : lower) if (x >= min) return band;
  return 1;
}

/** Regla de enrutado: ≥ 60 % de aciertos en el router → módulo difícil. */
export const ROUTER_THRESHOLD = 0.6;
export function routeModule(routerCorrect: number, routerTotal: number): 'lower' | 'upper' {
  if (routerTotal === 0) return 'lower';
  return routerCorrect / routerTotal >= ROUTER_THRESHOLD ? 'upper' : 'lower';
}

/** Proporción de puntos → banda (para Writing y Speaking, y R/L sin adaptatividad). */
export function proportionToBand(p: number): number {
  const x = Math.max(0, Math.min(1, p));
  const t: [number, number][] = [
    [0.95, 6], [0.86, 5.5], [0.76, 5], [0.66, 4.5], [0.56, 4], [0.46, 3.5], [0.36, 3], [0.26, 2.5], [0.16, 2], [0.08, 1.5],
  ];
  for (const [min, band] of t) if (x >= min) return band;
  return 1;
}

/**
 * Writing: 10 Build a Sentence (1 punto) + Email (0–5) + Academic Discussion (0–5).
 * Ponderamos las tareas de producción el doble que la suma bruta porque son las que discriminan nivel.
 */
export function toeflWritingBand(buildCorrect: number, buildTotal: number, email: number, discussion: number): number {
  const pBuild = buildTotal ? buildCorrect / buildTotal : 0;
  const pProd = (email + discussion) / 10;
  return proportionToBand(pBuild * 0.3 + pProd * 0.7);
}

/** Speaking: 7 Listen and Repeat + 4 Interview, 0–5 cada uno (máx. 55). */
export function toeflSpeakingBand(repeatScores: number[], interviewScores: number[]): number {
  const sum = [...repeatScores, ...interviewScores].reduce((a, b) => a + b, 0);
  const max = (repeatScores.length + interviewScores.length) * 5;
  return max ? proportionToBand(sum / max) : 1;
}

/** Formato de banda (4 → "4.0", 4.5 → "4.5"). */
export const fmtBand = (b: number) => b.toFixed(1);
