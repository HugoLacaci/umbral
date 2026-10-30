/**
 * Síntesis de voz con la Web Speech API (gratis, en el navegador).
 * Asigna voces distintas por hablante y acento; detecta qué acentos faltan.
 */
import type { Accent, Audio, Speaker } from '@/content/schema';

export const ACCENT_LABEL: Record<Accent, string> = {
  'en-US': 'EE. UU.',
  'en-GB': 'Reino Unido',
  'en-AU': 'Australia',
  'en-CA': 'Canadá',
  'en-NZ': 'Nueva Zelanda',
};

const FALLBACK: Record<Accent, Accent[]> = {
  'en-US': ['en-CA', 'en-GB'],
  'en-GB': ['en-AU', 'en-US'],
  'en-AU': ['en-NZ', 'en-GB'],
  'en-CA': ['en-US', 'en-GB'],
  'en-NZ': ['en-AU', 'en-GB'],
};

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let voicesP: Promise<SpeechSynthesisVoice[]> | null = null;
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  if (!voicesP)
    voicesP = new Promise((resolve) => {
      const v = speechSynthesis.getVoices();
      if (v.length) return resolve(v);
      const done = () => resolve(speechSynthesis.getVoices());
      speechSynthesis.addEventListener('voiceschanged', done, { once: true });
      setTimeout(done, 1500);
    });
  return voicesP;
}

const FEMALE = /female|woman|zira|susan|hazel|libby|sonia|natasha|catherine|karen|samantha|victoria|moira|tessa|fiona|serena|aria|jenny|michelle|emma|ava|clara|nicole|olivia|amy|joanna|kendra|salli|ruth|heather|google uk english female|google us english/i;
const MALE = /male|man\b|david|mark|george|ryan|thomas|william|guy|eric|christopher|brian|daniel|james|liam|oliver|arthur|alex|fred|rishi|google uk english male|matthew|justin|joey/i;

function genderOf(v: SpeechSynthesisVoice): 'f' | 'm' | '?' {
  if (FEMALE.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/i, ''))) return 'f';
  if (MALE.test(v.name)) return 'm';
  return '?';
}

export function voicesFor(all: SpeechSynthesisVoice[], accent: Accent): SpeechSynthesisVoice[] {
  const tag = accent.toLowerCase();
  return all.filter((v) => v.lang.replace('_', '-').toLowerCase() === tag);
}

/** Informe de cobertura de acentos para avisar al usuario. */
export async function accentCoverage(): Promise<{ accent: Accent; count: number }[]> {
  const all = await getVoices();
  return (Object.keys(ACCENT_LABEL) as Accent[]).map((accent) => ({ accent, count: voicesFor(all, accent).length }));
}

/** Asigna una voz estable a cada hablante procurando que sean distintas entre sí. */
export async function castVoices(speakers: Speaker[], preferred?: Record<string, string>): Promise<Record<string, SpeechSynthesisVoice | null>> {
  const all = await getVoices();
  const english = all.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const used = new Set<string>();
  const out: Record<string, SpeechSynthesisVoice | null> = {};
  for (const sp of speakers) {
    if (preferred?.[sp.id]) {
      const v = all.find((x) => x.voiceURI === preferred[sp.id]);
      if (v) {
        out[sp.id] = v;
        used.add(v.voiceURI);
        continue;
      }
    }
    const pools = [sp.accent, ...FALLBACK[sp.accent]].map((a) => voicesFor(all, a));
    let pick: SpeechSynthesisVoice | undefined;
    for (const pool of [...pools, english]) {
      const unused = pool.filter((v) => !used.has(v.voiceURI));
      pick =
        unused.find((v) => genderOf(v) === sp.gender && /natural|online|neural|premium|enhanced/i.test(v.name)) ??
        unused.find((v) => genderOf(v) === sp.gender) ??
        unused.find((v) => genderOf(v) === '?') ??
        unused[0] ??
        pool[0];
      if (pick) break;
    }
    out[sp.id] = pick ?? null;
    if (pick) used.add(pick.voiceURI);
  }
  return out;
}

export interface PlayHandle {
  stop: () => void;
  done: Promise<void>;
}

export interface PlayOptions {
  rate?: number;
  /** Se llama al empezar cada línea (índice). */
  onLine?: (i: number) => void;
  /** Se llama con el índice de carácter dentro de la línea (karaoke de transcripción). */
  onBoundary?: (line: number, charIndex: number) => void;
  startAt?: number;
  /** Pausa entre líneas (ms). */
  gap?: number;
}

/**
 * Reproduce un guion línea a línea. Chrome corta las locuciones largas (~15 s) si no se trocean,
 * así que cada línea se divide en frases.
 */
export function playAudio(audio: Audio, opts: PlayOptions = {}): PlayHandle {
  let stopped = false;
  const stop = () => {
    stopped = true;
    if (ttsSupported()) speechSynthesis.cancel();
  };
  const done = (async () => {
    if (!ttsSupported()) throw new Error('tts-unsupported');
    speechSynthesis.cancel();
    const cast = await castVoices(audio.speakers);
    const spk = Object.fromEntries(audio.speakers.map((s) => [s.id, s]));
    for (let i = opts.startAt ?? 0; i < audio.lines.length; i++) {
      if (stopped) return;
      const line = audio.lines[i];
      opts.onLine?.(i);
      const chunks = line.t.match(/[^.!?]+[.!?]*["”']?\s*/g) ?? [line.t];
      let offset = 0;
      for (const chunk of chunks) {
        if (stopped) return;
        await speakOne(chunk, cast[line.s], spk[line.s]?.accent ?? 'en-US', opts.rate ?? 1, (ci) => opts.onBoundary?.(i, offset + ci));
        offset += chunk.length;
      }
      if (opts.gap !== 0) await sleep(opts.gap ?? 350);
    }
  })();
  return { stop, done };
}

function speakOne(text: string, voice: SpeechSynthesisVoice | null | undefined, lang: string, rate: number, onBoundary?: (ci: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? lang;
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    u.onboundary = (e) => onBoundary?.(e.charIndex);
    speechSynthesis.speak(u);
    // Salvaguarda: algunos navegadores no disparan onend
    const ms = Math.max(4000, (text.length / 12) * 1000 * (1 / rate) + 4000);
    setTimeout(resolve, ms);
  });
}

/** Lee un texto suelto (flashcards, respuestas modelo). */
export function say(text: string, accent: Accent = 'en-US', rate = 1, gender: 'f' | 'm' = 'f'): PlayHandle {
  return playAudio({ speakers: [{ id: 'x', name: 'x', gender, accent }], lines: [{ s: 'x', t: text }] }, { rate, gap: 0 });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Duración estimada de un guion a velocidad 1 (≈ 155 palabras/min). */
export function estimateDuration(audio: Audio, rate = 1): number {
  const words = audio.lines.reduce((s, l) => s + l.t.split(/\s+/).length, 0);
  return Math.round((words / 155) * 60 / rate + audio.lines.length * 0.35);
}
