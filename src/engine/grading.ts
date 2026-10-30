/**
 * Corrección de ítems objetivos. Reglas tipo IELTS para huecos:
 *  - se respeta el límite de palabras ("NO MORE THAN TWO WORDS AND/OR A NUMBER");
 *  - la mala ortografía cuenta como error (igual que en el examen), aunque avisamos de que era casi correcta;
 *  - mayúsculas, espacios y la diferencia guion/espacio no penalizan; se aceptan las variantes listadas (UK/US).
 */
import type { Item, GapItem } from '@/content/schema';

export type Response = string | number | number[] | null | undefined;

export interface ItemResult {
  earned: number;
  max: number;
  correct: boolean;
  /** Motivo del fallo en huecos. */
  reason?: 'blank' | 'spelling' | 'too-many-words' | 'wrong';
}

const NUMERIC = /^[£$€¥]?\d[\d,.:/]*(%|am|pm|st|nd|rd|th|km|kg|m|cm)?$/i;

/** Cuenta palabras y números como lo hace el IELTS (un número = 1 token; palabra con guion = 1 palabra). */
export function countAnswerWords(answer: string): { words: number; numbers: number } {
  const tokens = answer.trim().split(/\s+/).filter(Boolean);
  let numbers = 0;
  for (const t of tokens) if (NUMERIC.test(t)) numbers++;
  return { words: tokens.length - numbers, numbers };
}

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .trim()
    .replace(/[.,;:!?]+$/g, '')
    .replace(/"/g, '')
    .replace(/^'+|'+$/g, '')
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distancia de Levenshtein (para detectar "casi bien escrito"). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function exceedsLimit(item: Pick<GapItem, 'maxWords' | 'allowNumber'>, answer: string): boolean {
  const { words, numbers } = countAnswerWords(answer);
  if (item.allowNumber) return words > item.maxWords || numbers > 1;
  return words + numbers > item.maxWords;
}

export function gradeGap(item: GapItem, raw: string | null | undefined): ItemResult {
  const answer = (raw ?? '').trim();
  if (!answer) return { earned: 0, max: 1, correct: false, reason: 'blank' };
  const accepted = item.answers.map(normalizeAnswer);
  // Un teléfono o código escrito con espacios ("07816 443902") cuenta como un único número,
  // y un símbolo de moneda que ya está en la plantilla ("£52") no penaliza.
  const compact = normalizeAnswer(answer).replace(/^[£$€¥]\s*/, '');
  if (accepted.includes(compact) || (/^[\d\s]+$/.test(compact) && accepted.includes(compact.replace(/\s+/g, ''))))
    return { earned: 1, max: 1, correct: true };
  if (exceedsLimit(item, answer)) return { earned: 0, max: 1, correct: false, reason: 'too-many-words' };
  const n = normalizeAnswer(answer);
  if (accepted.includes(n)) return { earned: 1, max: 1, correct: true };
  const close = accepted.some((a) => a.length > 3 && levenshtein(a, n) <= (a.length > 7 ? 2 : 1));
  return { earned: 0, max: 1, correct: false, reason: close ? 'spelling' : 'wrong' };
}

/** Nº de puntos que vale un ítem (un "choose TWO" vale 2 en IELTS). */
export function itemMax(item: Item): number {
  return item.kind === 'multi' ? item.answers.length : 1;
}

export function gradeItem(item: Item, response: Response): ItemResult {
  switch (item.kind) {
    case 'mcq': {
      const ok = response === item.answer;
      return { earned: ok ? 1 : 0, max: 1, correct: ok, reason: response == null ? 'blank' : ok ? undefined : 'wrong' };
    }
    case 'multi': {
      const sel = Array.isArray(response) ? response : [];
      // En IELTS cada opción correcta es una pregunta; elegir más de las pedidas no suma.
      const picked = sel.slice(0, item.answers.length);
      const earned = picked.filter((x) => item.answers.includes(x)).length;
      return { earned, max: item.answers.length, correct: earned === item.answers.length, reason: sel.length ? undefined : 'blank' };
    }
    case 'judge': {
      const ok = typeof response === 'string' && response.toUpperCase() === item.answer;
      return { earned: ok ? 1 : 0, max: 1, correct: ok, reason: response ? (ok ? undefined : 'wrong') : 'blank' };
    }
    case 'match': {
      const ok = typeof response === 'string' && response.trim().toLowerCase() === item.answer.toLowerCase();
      return { earned: ok ? 1 : 0, max: 1, correct: ok, reason: response ? (ok ? undefined : 'wrong') : 'blank' };
    }
    case 'gap':
      return gradeGap(item, typeof response === 'string' ? response : response == null ? '' : String(response));
  }
}

/** Texto legible de la respuesta correcta. */
export function correctAnswerText(item: Item, options?: { key: string; text: string }[]): string {
  switch (item.kind) {
    case 'mcq':
      return `${String.fromCharCode(65 + item.answer)}. ${item.options[item.answer]}`;
    case 'multi':
      return item.answers.map((a) => `${String.fromCharCode(65 + a)}`).join(', ');
    case 'judge':
      return item.answer;
    case 'match': {
      const o = options?.find((x) => x.key === item.answer);
      return o ? `${o.key} — ${o.text}` : item.answer;
    }
    case 'gap':
      return item.answers[0];
  }
}
