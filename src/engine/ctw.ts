/** Complete the Words (TOEFL 2026): parseo del formato [[palabraCompleta|prefijoVisible]]. */

export interface CtwBlank {
  index: number;
  full: string;
  shown: string;
  /** Nº de letras que faltan. */
  missing: number;
}

export type CtwSegment = string | CtwBlank;

const RE = /\[\[([^|\]]+)\|([^\]]*)\]\]/g;

export function parseCtw(text: string): { segments: CtwSegment[]; blanks: CtwBlank[] } {
  const segments: CtwSegment[] = [];
  const blanks: CtwBlank[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    if (m.index! > last) segments.push(text.slice(last, m.index));
    const blank: CtwBlank = { index: blanks.length, full: m[1], shown: m[2], missing: m[1].length - m[2].length };
    blanks.push(blank);
    segments.push(blank);
    last = m.index! + m[0].length;
  }
  if (last < text.length) segments.push(text.slice(last));
  return { segments, blanks };
}

/** ¿Las letras escritas completan bien la palabra? (sin distinguir mayúsculas) */
export function checkCtwBlank(blank: CtwBlank, typed: string): boolean {
  return (blank.shown + typed.trim()).toLowerCase() === blank.full.toLowerCase();
}

/** Texto plano (para TTS o para mostrar la solución). */
export function ctwPlain(text: string): string {
  return text.replace(RE, (_, full) => full);
}
