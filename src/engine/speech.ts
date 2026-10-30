/**
 * Reconocimiento de voz (SpeechRecognition, Chrome/Edge) + grabación (MediaRecorder).
 * Si el reconocimiento no existe, la app sigue grabando y ofrece transcribir a mano / autoevaluarse.
 */

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export function sttSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function recorderSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

export interface LiveSession {
  stop: () => Promise<SessionResult>;
}

export interface SessionResult {
  transcript: string;
  durationSec: number;
  /** Silencios entre resultados finales (s). */
  pauses: number[];
  confidences: number[];
  audioUrl: string | null;
  sttError?: string;
}

/**
 * Empieza a grabar y transcribir. onText recibe la transcripción (final + provisional) en vivo.
 */
export async function startSpeaking(onText: (finalText: string, interim: string) => void, lang = 'en-US'): Promise<LiveSession> {
  const start = performance.now();
  let stream: MediaStream | null = null;
  let rec: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  if (recorderSupported()) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(250);
    } catch {
      stream = null;
      rec = null;
    }
  }

  let finalText = '';
  const pauses: number[] = [];
  const confidences: number[] = [];
  let lastFinalAt = performance.now();
  let sttError: string | undefined;
  let active = true;
  let sr: SR | null = null;

  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (Ctor) {
    const makeSr = () => {
      const r: SR = new Ctor();
      r.lang = lang;
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) {
            const now = performance.now();
            const gap = (now - lastFinalAt) / 1000;
            // La duración del propio fragmento no es pausa: estimamos 2.6 palabras/s
            const spoken = res[0].transcript.trim().split(/\s+/).length / 2.6;
            if (finalText) pauses.push(Math.max(0, gap - spoken));
            lastFinalAt = now;
            finalText = (finalText + ' ' + res[0].transcript).trim();
            if (typeof res[0].confidence === 'number' && res[0].confidence > 0) confidences.push(res[0].confidence);
          } else interim += res[0].transcript;
        }
        onText(finalText, interim);
      };
      r.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') sttError = e.error;
      };
      // Chrome corta tras silencios: reiniciamos mientras sigamos grabando
      r.onend = () => {
        if (active) {
          try {
            sr = makeSr();
            sr.start();
          } catch {
            /* ignore */
          }
        }
      };
      return r;
    };
    sr = makeSr();
    try {
      sr.start();
    } catch (e) {
      sttError = String(e);
    }
  } else sttError = 'unsupported';

  return {
    stop: () =>
      new Promise<SessionResult>((resolve) => {
        active = false;
        try {
          sr?.stop();
        } catch {
          /* ignore */
        }
        const durationSec = (performance.now() - start) / 1000;
        const finish = () => {
          stream?.getTracks().forEach((t) => t.stop());
          const audioUrl = chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec?.mimeType || 'audio/webm' })) : null;
          // Damos un instante para que llegue el último resultado final
          setTimeout(() => resolve({ transcript: finalText, durationSec, pauses, confidences, audioUrl, sttError }), 450);
        };
        if (rec && rec.state !== 'inactive') {
          rec.onstop = finish;
          rec.stop();
        } else finish();
      }),
  };
}
