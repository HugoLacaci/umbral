/**
 * Métricas de Speaking sobre la transcripción de SpeechRecognition.
 * Importante: el navegador no evalúa la pronunciación real; aquí sólo hay aproximaciones honestas.
 */
import { tokenize, analyzeText } from './textAnalysis';
import type { CriterionEstimate } from './textAnalysis';

export const FILLERS = ['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'like', 'you know', 'i mean', 'sort of', 'kind of', 'basically', 'actually', 'literally', 'well'];

export interface SpeakingMetrics {
  words: number;
  durationSec: number;
  wpm: number;
  fillers: { word: string; count: number }[];
  fillerRate: number;
  /** Pausas de más de 2 s (detectadas por huecos entre resultados del reconocedor). */
  longPauses: number;
  mattr: number;
  subordinateRatio: number;
  avgConfidence?: number;
}

export function speakingMetrics(transcript: string, durationSec: number, pauses: number[] = [], confidences: number[] = []): SpeakingMetrics {
  const tokens = tokenize(transcript);
  const lower = ` ${tokens.join(' ')} `;
  const fillers = FILLERS.map((f) => ({ word: f, count: (lower.match(new RegExp(` ${f} `, 'g')) ?? []).length })).filter((f) => f.count > 0);
  // "like" y "well" son muletillas sólo a veces: los contamos con la mitad de peso.
  const fillerCount = fillers.reduce((s, f) => s + (['like', 'well', 'actually'].includes(f.word) ? f.count / 2 : f.count), 0);
  const a = analyzeText(transcript);
  return {
    words: tokens.length,
    durationSec,
    wpm: durationSec > 0 ? Math.round((tokens.length / durationSec) * 60) : 0,
    fillers,
    fillerRate: tokens.length ? Math.round((fillerCount / tokens.length) * 1000) / 10 : 0,
    longPauses: pauses.filter((p) => p > 2).length,
    mattr: a.mattr,
    subordinateRatio: a.subordinateRatio,
    avgConfidence: confidences.length ? Math.round((confidences.reduce((x, y) => x + y, 0) / confidences.length) * 100) / 100 : undefined,
  };
}

export interface DiffToken {
  word: string;
  status: 'ok' | 'missing' | 'extra';
}

/** Alineación palabra a palabra (LCS) entre la frase original y lo que se ha dicho. */
export function repeatAccuracy(target: string, said: string): { accuracy: number; diff: DiffToken[] } {
  const a = tokenize(target).map(expand);
  const b = tokenize(said).map(expand);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const diff: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      diff.push({ word: a[i], status: 'ok' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) diff.push({ word: a[i++], status: 'missing' });
    else diff.push({ word: b[j++], status: 'extra' });
  }
  while (i < n) diff.push({ word: a[i++], status: 'missing' });
  while (j < m) diff.push({ word: b[j++], status: 'extra' });
  const lcs = dp[0][0];
  // Penaliza también las palabras añadidas (precisión + exhaustividad → F1)
  const recall = n ? lcs / n : 0;
  const precision = m ? lcs / m : 0;
  const accuracy = recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
  return { accuracy: Math.round(accuracy * 100) / 100, diff };
}

/** Normaliza contracciones para no penalizar "it's" vs "it is". */
function expand(w: string): string {
  return w.replace(/'s$/, '').replace(/n't$/, '').replace(/'re$/, '').replace(/'ll$/, '').replace(/'ve$/, '').replace(/'m$/, '').replace(/'d$/, '');
}

/** TOEFL Listen and Repeat: precisión → puntuación 0–5. */
export function repeatScore(accuracy: number): number {
  if (accuracy >= 0.95) return 5;
  if (accuracy >= 0.85) return 4;
  if (accuracy >= 0.7) return 3;
  if (accuracy >= 0.5) return 2;
  if (accuracy >= 0.25) return 1;
  return 0;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const half = (x: number) => Math.round(x * 2) / 2;

/** Estimación IELTS Speaking (4 criterios). Pronunciation es la menos fiable: sólo usa la confianza del reconocedor. */
export function estimateIeltsSpeaking(m: SpeakingMetrics): { criteria: CriterionEstimate[]; band: number } {
  const fcNotes: string[] = [`${m.wpm} palabras/min (natural: 110–170).`, `Muletillas: ${m.fillerRate} % de las palabras.`];
  let fc = 6.5;
  if (m.wpm < 70) fc -= 1.5;
  else if (m.wpm < 95) fc -= 0.75;
  else if (m.wpm > 190) fc -= 0.5;
  else if (m.wpm >= 120) fc += 0.5;
  fc -= clamp(m.fillerRate / 3, 0, 1.5);
  fc -= clamp(m.longPauses * 0.25, 0, 1.5);
  if (m.longPauses) fcNotes.push(`${m.longPauses} pausa(s) largas (> 2 s).`);
  if (m.words < 40) {
    fc = Math.min(fc, 5);
    fcNotes.push('Respuesta muy corta: desarrolla más (razón + ejemplo).');
  }
  const lr = 4.5 + clamp((m.mattr - 0.55) * 10, 0, 3);
  const gra = 5 + clamp(m.subordinateRatio * 1.5, 0, 2);
  const pr = m.avgConfidence !== undefined ? 4.5 + clamp((m.avgConfidence - 0.6) * 10, 0, 3) : 6;
  const criteria: CriterionEstimate[] = [
    { key: 'FC', score: half(clamp(fc, 4, 8.5)), notes: fcNotes },
    { key: 'LR', score: half(clamp(lr, 4, 8.5)), notes: [`Variedad léxica (MATTR) ${m.mattr}.`] },
    { key: 'GRA', score: half(clamp(gra, 4, 8.5)), notes: [`Oraciones subordinadas por frase: ${m.subordinateRatio}.`, 'La precisión gramatical no se mide automáticamente en voz.'] },
    {
      key: 'P',
      score: half(clamp(pr, 4, 8.5)),
      notes: [
        m.avgConfidence !== undefined
          ? `Confianza media del reconocedor de voz: ${Math.round(m.avgConfidence * 100)} % (sólo una pista; no mide acento, entonación ni ritmo).`
          : 'Sin datos fiables: autoevalúate con la rúbrica.',
      ],
    },
  ];
  const avg = criteria.reduce((s, c) => s + c.score, 0) / 4;
  return { criteria, band: Math.floor(avg * 2 + 1e-9) / 2 };
}

/** Estimación TOEFL Interview 0–5 a partir de las métricas. */
export function estimateToeflInterview(m: SpeakingMetrics): { score: number; notes: string[] } {
  const notes: string[] = [];
  let s = 3;
  if (m.words >= 90) s += 1;
  else if (m.words < 50) {
    s -= 1;
    notes.push(`Sólo ${m.words} palabras en ${Math.round(m.durationSec)} s: intenta llenar los 45 s.`);
  }
  if (m.mattr >= 0.72) s += 0.5;
  if (m.subordinateRatio >= 0.6) s += 0.5;
  if (m.fillerRate > 5) {
    s -= 1;
    notes.push('Demasiadas muletillas.');
  }
  if (m.longPauses > 2) {
    s -= 0.5;
    notes.push('Varias pausas largas.');
  }
  notes.push(`${m.wpm} palabras/min · MATTR ${m.mattr}.`);
  return { score: clamp(Math.round(s), 0, 5), notes };
}
