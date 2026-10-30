import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Play, Volume2, AlertTriangle, ChevronRight, Loader2, Sparkles, Wand2, Timer, NotebookPen } from 'lucide-react';
import type { IeltsSpeakingP1, IeltsSpeakingP2, IeltsSpeakingP3, ToeflInterviewSet, ToeflRepeatSet, Speaker } from '@/content/schema';
import { startSpeaking, sttSupported, recorderSupported, type LiveSession } from '@/engine/speech';
import { say, ttsSupported } from '@/engine/tts';
import { speakingMetrics, repeatAccuracy, repeatScore, estimateIeltsSpeaking, estimateToeflInterview, type SpeakingMetrics } from '@/engine/speaking';
import { geminiEvaluate, buildSpeakingPrompt, type AiFeedback } from '@/engine/ai';
import { Button, Card, Notice, Badge, SectionTitle, ProgressBar } from '@/components/ui';
import { AiFeedbackView } from '../writing/WritingTask';
import { useApp } from '@/store';
import { useT } from '@/i18n';
import { cn, fmtTime } from '@/lib/cn';

export type SpeakingKind = 'toefl.repeat' | 'toefl.interview' | 'ielts.p1' | 'ielts.p2' | 'ielts.p3';
export type SpeakingTaskData = ToeflRepeatSet | ToeflInterviewSet | IeltsSpeakingP1 | IeltsSpeakingP2 | IeltsSpeakingP3;

interface Step {
  prompt: string;
  /** Texto que se lee en voz alta antes de grabar. */
  speak?: string;
  /** Si el texto se muestra en pantalla (en Listen and Repeat NO: sólo se oye). */
  showPrompt: boolean;
  prep?: number;
  /** Límite de grabación (s). */
  limit: number;
  /** true = se corta solo al llegar al límite (TOEFL / Part 2). */
  hard: boolean;
  target?: string;
}

export interface SpeakingResponse {
  prompt: string;
  transcript: string;
  durationSec: number;
  audioUrl: string | null;
  metrics: SpeakingMetrics;
  accuracy?: number;
  score?: number;
}

export interface SpeakingOutcome {
  responses: SpeakingResponse[];
  /** TOEFL: puntos (0–5 por ítem). IELTS: banda estimada. */
  itemScores?: number[];
  band?: number;
  criteria?: { key: string; score: number; notes: string[] }[];
}

const EXAMINER: Speaker = { id: 'ex', name: 'Examiner', gender: 'f', accent: 'en-GB' };

function buildSteps(kind: SpeakingKind, task: SpeakingTaskData): { intro?: string; steps: Step[]; voice: Speaker } {
  switch (kind) {
    case 'toefl.repeat': {
      const r = task as ToeflRepeatSet;
      return {
        voice: r.speaker,
        steps: r.sentences.map((s) => ({ prompt: s, speak: s, showPrompt: false, limit: Math.min(18, Math.max(8, Math.round(s.split(/\s+/).length * 0.65 + 5))), hard: true, target: s })),
      };
    }
    case 'toefl.interview': {
      const r = task as ToeflInterviewSet;
      return { voice: r.interviewer, intro: r.intro, steps: r.questions.map((q) => ({ prompt: q, speak: q, showPrompt: true, limit: 45, hard: true })) };
    }
    case 'ielts.p1': {
      const r = task as IeltsSpeakingP1;
      return { voice: EXAMINER, intro: `Now, let's talk about ${r.topic.toLowerCase()}.`, steps: r.questions.map((q) => ({ prompt: q, speak: q, showPrompt: true, limit: 40, hard: false })) };
    }
    case 'ielts.p2': {
      const r = task as IeltsSpeakingP2;
      const card = `${r.cue}\n\nYou should say:\n${r.bullets.map((b) => `• ${b}`).join('\n')}\n${r.closing}`;
      return {
        voice: EXAMINER,
        intro: "Now I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish.",
        steps: [
          { prompt: card, showPrompt: true, prep: 60, limit: 120, hard: true },
          ...r.followUps.map((q) => ({ prompt: q, speak: q, showPrompt: true, limit: 25, hard: false })),
        ],
      };
    }
    case 'ielts.p3': {
      const r = task as IeltsSpeakingP3;
      return { voice: EXAMINER, intro: `We've been talking about ${r.topic.toLowerCase()}. I'd like to discuss with you some more general questions related to this.`, steps: r.questions.map((q) => ({ prompt: q, speak: q, showPrompt: true, limit: 75, hard: false })) };
    }
  }
}

function speakAsync(text: string, v: Speaker): Promise<void> {
  if (!ttsSupported()) return Promise.resolve();
  return say(text, v.accent, 0.98, v.gender).done.catch(() => undefined);
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.18);
  } catch {
    /* sin audio */
  }
}

/** Ejecuta la tarea de Speaking completa. En modo examen no hay feedback (lo da el informe). */
export function SpeakingRunner({
  kind,
  task,
  mode,
  onComplete,
}: {
  kind: SpeakingKind;
  task: SpeakingTaskData;
  mode: 'practice' | 'exam';
  onComplete: (o: SpeakingOutcome) => void;
}) {
  const t = useT();
  const plan = useMemo(() => buildSteps(kind, task), [kind, task]);
  const [phase, setPhase] = useState<'ready' | 'intro' | 'speaking' | 'prep' | 'recording' | 'processing' | 'done'>('ready');
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [live, setLive] = useState('');
  const [notes, setNotes] = useState('');
  const [responses, setResponses] = useState<SpeakingResponse[]>([]);
  const [manual, setManual] = useState('');
  const session = useRef<LiveSession | null>(null);
  const cancelled = useRef(false);
  const step = plan.steps[i];
  const stt = sttSupported();

  useEffect(
    () => () => {
      cancelled.current = true;
      session.current?.stop();
      if (ttsSupported()) speechSynthesis.cancel();
    },
    [],
  );

  // Cuenta atrás (preparación o grabación)
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'recording') return;
    if (left <= 0) {
      if (phase === 'prep') startRecording();
      else if (step.hard) stopRecording();
      return;
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left]);

  const begin = async () => {
    if (plan.intro) {
      setPhase('intro');
      await speakAsync(plan.intro, plan.voice);
    }
    if (!cancelled.current) runStep(0);
  };

  const runStep = async (k: number) => {
    setI(k);
    setLive('');
    setManual('');
    const s = plan.steps[k];
    if (s.speak) {
      setPhase('speaking');
      await speakAsync(s.speak, plan.voice);
      if (cancelled.current) return;
    }
    if (s.prep) {
      setLeft(s.prep);
      setPhase('prep');
    } else startRecording(k);
  };

  const startRecording = async (k = i) => {
    beep();
    setLeft(plan.steps[k].limit);
    setPhase('recording');
    session.current = await startSpeaking((f, interim) => setLive(`${f} ${interim}`.trim()));
  };

  const stopRecording = async () => {
    if (!session.current) return;
    setPhase('processing');
    const r = await session.current.stop();
    session.current = null;
    const transcript = (r.transcript || manual).trim();
    const metrics = speakingMetrics(transcript, r.durationSec, r.pauses, r.confidences);
    const resp: SpeakingResponse = { prompt: step.prompt, transcript, durationSec: r.durationSec, audioUrl: r.audioUrl, metrics };
    if (step.target) {
      const acc = repeatAccuracy(step.target, transcript);
      resp.accuracy = acc.accuracy;
      resp.score = transcript ? repeatScore(acc.accuracy) : 0;
    } else if (kind === 'toefl.interview') resp.score = transcript ? estimateToeflInterview(metrics).score : 0;
    const all = [...responses, resp];
    setResponses(all);
    if (i + 1 < plan.steps.length) runStep(i + 1);
    else finish(all);
  };

  const finish = (all: SpeakingResponse[]) => {
    setPhase('done');
    const outcome: SpeakingOutcome = { responses: all };
    if (kind.startsWith('toefl')) outcome.itemScores = all.map((r) => r.score ?? 0);
    else {
      const joined = all.map((r) => r.transcript).join(' ');
      const dur = all.reduce((s, r) => s + r.durationSec, 0);
      const m = speakingMetrics(joined, dur, [], all.flatMap((r) => (r.metrics.avgConfidence ? [r.metrics.avgConfidence] : [])));
      const e = estimateIeltsSpeaking({ ...m, longPauses: all.reduce((s, r) => s + r.metrics.longPauses, 0) });
      outcome.band = e.band;
      outcome.criteria = e.criteria;
    }
    onComplete(outcome);
  };

  const progress = ((i + (phase === 'done' ? 1 : 0)) / plan.steps.length) * 100;

  if (phase === 'ready')
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {!recorderSupported() && <Notice tone="bad" icon={<AlertTriangle size={16} />}>{t('Este navegador no permite grabar audio. Prueba con Chrome o Edge.', 'This browser cannot record audio. Try Chrome or Edge.')}</Notice>}
        {!stt && (
          <Notice tone="warn" icon={<AlertTriangle size={16} />}>
            {t(
              'Tu navegador no tiene reconocimiento de voz (SpeechRecognition): podrás grabarte y escucharte, y escribir lo que has dicho para obtener métricas, pero no habrá transcripción automática. Funciona en Chrome y Edge.',
              'Your browser lacks speech recognition: you can record and replay, and type what you said to get metrics, but there is no automatic transcript. Works in Chrome and Edge.',
            )}
          </Notice>
        )}
        <Card className="p-6 text-center">
          <Mic className="mx-auto text-accent" size={32} />
          <h2 className="mt-3 text-xl font-bold">{t('Prepárate para hablar', 'Get ready to speak')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {kind === 'toefl.repeat'
              ? t('Oirás 7 frases UNA sola vez. Repite cada una exactamente tras el pitido. La grabación se corta sola.', "You'll hear 7 sentences ONCE. Repeat each exactly after the beep. Recording stops automatically.")
              : kind === 'toefl.interview'
                ? t('4 preguntas sin tiempo de preparación. Tienes 45 segundos para cada respuesta.', '4 questions, no preparation time. 45 seconds per answer.')
                : kind === 'ielts.p2'
                  ? t('1 minuto para preparar con notas y hasta 2 minutos hablando. El examinador te corta a los 2 minutos.', '1 minute to prepare with notes, then up to 2 minutes. The examiner stops you at 2 minutes.')
                  : t('Responde con naturalidad y desarrolla: respuesta + razón + ejemplo. Pulsa «Siguiente» al terminar cada respuesta.', 'Answer naturally and extend: answer + reason + example. Press "Next" after each answer.')}
          </p>
          {kind === 'toefl.repeat' && (
            <div className="mx-auto mt-4 max-w-md rounded-xl bg-surface-2 p-3 text-left text-sm">
              <div className="font-medium">{(task as ToeflRepeatSet).context}</div>
              <div className="mt-1 text-muted italic">🖼 {(task as ToeflRepeatSet).visual}</div>
            </div>
          )}
          <Button className="mt-5" size="lg" onClick={begin}>
            <Play size={16} /> {t('Empezar', 'Start')}
          </Button>
          <p className="mt-2 text-xs text-faint">{t('El navegador te pedirá permiso para usar el micrófono. Nada se sube a ningún servidor.', 'The browser will ask for microphone access. Nothing is uploaded.')}</p>
        </Card>
      </div>
    );

  if (phase === 'done') return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="font-mono">
          {Math.min(i + 1, plan.steps.length)}/{plan.steps.length}
        </span>
        <ProgressBar value={progress} />
      </div>
      {kind === 'toefl.repeat' && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="font-medium">{(task as ToeflRepeatSet).context}</div>
          <div className="mt-1 text-muted italic">🖼 {(task as ToeflRepeatSet).visual}</div>
        </div>
      )}
      <Card className="p-6">
        {phase === 'intro' && (
          <p className="flex items-center gap-2 text-muted">
            <Volume2 className="animate-pulse text-accent" size={18} /> {plan.intro}
          </p>
        )}
        {phase !== 'intro' && step && (
          <>
            {step.showPrompt ? (
              kind === 'ielts.p2' && i === 0 ? (
                <div className="rounded-xl border-2 border-line-strong bg-surface p-4 font-serif text-[16px] leading-relaxed whitespace-pre-line">{step.prompt}</div>
              ) : (
                <p className="text-[18px] leading-snug font-medium">{step.prompt}</p>
              )
            ) : (
              <p className="flex items-center gap-2 text-muted">
                <Volume2 size={18} className={cn(phase === 'speaking' && 'animate-pulse text-accent')} />
                {phase === 'speaking' ? t('Escucha…', 'Listen…') : t('Repite la frase que has oído', 'Repeat the sentence you heard')}
              </p>
            )}
            {phase === 'speaking' && step.showPrompt && (
              <p className="mt-3 flex items-center gap-2 text-sm text-accent">
                <Volume2 size={16} className="animate-pulse" /> {t('El examinador está hablando…', 'The examiner is speaking…')}
              </p>
            )}
            {phase === 'prep' && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <NotebookPen size={16} /> {t('Preparación: toma notas', 'Preparation: make notes')}
                  </span>
                  <span className="font-mono text-lg font-bold text-accent">{fmtTime(left)}</span>
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="h-32 w-full rounded-xl border border-line-strong bg-surface p-3 text-sm outline-none focus:border-accent" placeholder={t('Palabras clave, no frases completas…', 'Key words, not full sentences…')} />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setLeft(0)}>
                  {t('Empezar a hablar ya', 'Start speaking now')}
                </Button>
              </div>
            )}
            {phase === 'recording' && (
              <div className="mt-5">
                {kind === 'ielts.p2' && i === 0 && notes && <div className="mb-3 rounded-lg bg-warn-soft p-2 text-[13px] whitespace-pre-line text-warn">{notes}</div>}
                <div className="flex items-center gap-4">
                  <span className="relative flex h-12 w-12 items-center justify-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-bad/30" />
                    <span className="relative grid h-12 w-12 place-items-center rounded-full bg-bad text-white">
                      <Mic size={20} />
                    </span>
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-bad">{t('Grabando', 'Recording')}</span>
                      <span className="flex items-center gap-1 font-mono text-lg font-bold">
                        <Timer size={16} /> {fmtTime(Math.max(0, left))}
                      </span>
                    </div>
                    <ProgressBar value={step.limit - left} max={step.limit} tone={left < 10 ? 'bad' : 'accent'} className="mt-1" />
                    {!step.hard && left <= 0 && <p className="mt-1 text-xs text-warn">{t('Tiempo orientativo superado: en el examen el examinador te interrumpiría.', 'Suggested time exceeded: an examiner would move on.')}</p>}
                  </div>
                </div>
                {stt ? (
                  <p className="mt-4 min-h-12 rounded-xl bg-surface-2 p-3 text-[14.5px] text-muted italic">{live || t('(la transcripción aparecerá aquí)', '(transcript will appear here)')}</p>
                ) : (
                  <textarea value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('Opcional: escribe después lo que has dicho para obtener métricas', 'Optional: type what you said to get metrics')} className="mt-4 h-20 w-full rounded-xl border border-line bg-surface p-2.5 text-sm" />
                )}
                <div className="mt-4 flex justify-end">
                  <Button onClick={stopRecording} variant={step.hard ? 'outline' : 'primary'}>
                    {i + 1 < plan.steps.length ? (
                      <>
                        {t('Siguiente', 'Next')} <ChevronRight size={16} />
                      </>
                    ) : (
                      <>
                        <Square size={14} /> {t('Terminar', 'Finish')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            {phase === 'processing' && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Loader2 size={15} className="animate-spin" /> {t('Procesando…', 'Processing…')}
              </p>
            )}
          </>
        )}
      </Card>
      {mode === 'exam' && <p className="text-center text-xs text-faint">{t('Modo examen: sin repeticiones ni pausas.', 'Exam mode: no replays or pauses.')}</p>}
    </div>
  );
}

/* ─────────── Resultados (práctica e informe) ─────────── */

const CRIT: Record<string, string> = { FC: 'Fluency & Coherence', LR: 'Lexical Resource', GRA: 'Grammatical Range & Accuracy', P: 'Pronunciation' };

export function SpeakingResults({ kind, task, outcome, onSelf }: { kind: SpeakingKind; task: SpeakingTaskData; outcome: SpeakingOutcome; onSelf?: (v: number) => void }) {
  const t = useT();
  const geminiKey = useApp((s) => s.geminiKey);
  const [ai, setAi] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; data?: AiFeedback; error?: string }>({ status: 'idle' });
  const [self, setSelf] = useState<number | null>(null);
  const isIelts = kind.startsWith('ielts');
  const samples: (string | undefined)[] =
    kind === 'toefl.interview'
      ? (task as ToeflInterviewSet).sampleAnswers
      : kind === 'ielts.p1'
        ? (task as IeltsSpeakingP1).sampleAnswers ?? []
        : kind === 'ielts.p3'
          ? (task as IeltsSpeakingP3).sampleAnswers ?? []
          : kind === 'ielts.p2'
            ? [(task as IeltsSpeakingP2).sampleAnswer]
            : [];
  const total = outcome.itemScores?.reduce((a, b) => a + b, 0);

  const runAi = async () => {
    setAi({ status: 'loading' });
    try {
      const data = await geminiEvaluate(
        geminiKey,
        buildSpeakingPrompt({
          exam: isIelts ? 'ielts' : 'toefl',
          task: kind,
          questions: outcome.responses.map((r) => r.prompt).join('\n'),
          transcript: outcome.responses.map((r, i) => `Q${i + 1}: ${r.transcript}`).join('\n'),
          metrics: outcome.responses.map((r) => `${r.metrics.wpm} wpm, fillers ${r.metrics.fillerRate}%, long pauses ${r.metrics.longPauses}`).join(' | '),
          lang: t.lang,
        }),
      );
      setAi({ status: 'done', data });
    } catch (e) {
      setAi({ status: 'error', error: (e as Error).message });
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          sub={t('Estimación orientativa a partir de la transcripción: el navegador no puede evaluar tu pronunciación real.', 'Approximate estimate from the transcript: the browser cannot assess real pronunciation.')}
          action={
            <div className="text-right">
              <div className="font-display text-3xl font-bold text-accent">{isIelts ? outcome.band?.toFixed(1) : `${total}/${(outcome.itemScores?.length ?? 0) * 5}`}</div>
              <div className="text-[11px] text-faint">{isIelts ? t('banda estimada', 'estimated band') : t('puntos estimados', 'estimated points')}</div>
            </div>
          }
        >
          {t('Resultado', 'Result')}
        </SectionTitle>
        {outcome.criteria && (
          <div className="grid gap-3 sm:grid-cols-2">
            {outcome.criteria.map((c) => (
              <div key={c.key} className="rounded-xl border border-line p-3">
                <div className="flex justify-between text-[13.5px] font-semibold">
                  <span>{CRIT[c.key]}</span>
                  <span className="font-mono">{c.score.toFixed(1)}</span>
                </div>
                <ul className="mt-1 space-y-0.5 text-[12.5px] text-muted">
                  {c.notes.map((n, i) => (
                    <li key={i}>· {n}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {outcome.responses.map((r, i) => (
          <Card key={i} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="text-[14.5px] font-medium whitespace-pre-line">
                <span className="mr-1.5 text-accent">{i + 1}.</span>
                {kind === 'ielts.p2' && i === 0 ? (task as IeltsSpeakingP2).cue : r.prompt}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.score !== undefined && <Badge tone={r.score >= 4 ? 'good' : r.score >= 3 ? 'warn' : 'bad'}>{r.score}/5</Badge>}
                {r.accuracy !== undefined && <Badge tone="accent">{Math.round(r.accuracy * 100)} %</Badge>}
                <Badge>{r.metrics.wpm} wpm</Badge>
                <Badge>{Math.round(r.durationSec)} s</Badge>
                {r.metrics.fillers.length > 0 && <Badge tone="warn">{t('muletillas', 'fillers')}: {r.metrics.fillers.map((f) => `${f.word}×${f.count}`).join(' ')}</Badge>}
                {r.metrics.longPauses > 0 && <Badge tone="warn">{r.metrics.longPauses} {t('pausas largas', 'long pauses')}</Badge>}
              </div>
            </div>
            {r.audioUrl && <audio controls src={r.audioUrl} className="mt-3 h-9 w-full" />}
            {kind === 'toefl.repeat' && r.accuracy !== undefined ? (
              <p className="mt-2 text-[14.5px] leading-relaxed">
                {repeatAccuracy(r.prompt, r.transcript).diff.map((d, k) => (
                  <span key={k} className={cn('mr-1', d.status === 'missing' && 'text-bad underline decoration-dotted', d.status === 'extra' && 'text-warn line-through')}>
                    {d.word}
                  </span>
                ))}
              </p>
            ) : (
              <p className="mt-2 text-[14.5px] text-muted italic">{r.transcript || t('(sin transcripción)', '(no transcript)')}</p>
            )}
            {kind === 'toefl.repeat' && <p className="mt-1 text-xs text-faint">{t('Rojo: palabra que faltó · tachado: palabra añadida.', 'Red: missing word · struck: extra word.')}</p>}
            {samples[i] && (
              <details className="mt-2 text-[14px]">
                <summary className="cursor-pointer font-medium text-accent">{t('Respuesta modelo', 'Model answer')}</summary>
                <p className="mt-2 rounded-xl bg-surface-2 p-3 font-serif leading-relaxed">{samples[i]}</p>
                <Button size="sm" variant="ghost" className="mt-1" onClick={() => say(samples[i]!, isIelts ? 'en-GB' : 'en-US')}>
                  <Volume2 size={14} /> {t('Escuchar', 'Listen')}
                </Button>
              </details>
            )}
          </Card>
        ))}
      </div>

      {onSelf && (
        <Card className="p-5">
          <SectionTitle sub={t('Escúchate y ponte nota con la rúbrica (Study Room → rúbricas).', 'Listen back and grade yourself with the rubric.')}>{t('Autoevaluación', 'Self-assessment')}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {(isIelts ? [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] : [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]).map((b) => (
              <button
                key={b}
                onClick={() => {
                  setSelf(b);
                  onSelf(b);
                }}
                aria-pressed={self === b}
                className={cn('h-9 min-w-11 rounded-lg border px-2 font-mono text-sm', self === b ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong hover:border-accent')}
              >
                {b.toFixed(1)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">{isIelts ? t('Banda IELTS 0–9.', 'IELTS band 0–9.') : t('Banda TOEFL 1–6 para esta destreza.', 'TOEFL 1–6 band for this skill.')}</p>
        </Card>
      )}

      <Card className="p-5">
        <SectionTitle sub={t('Opcional, con tu propia API key de Gemini. La IA sólo ve la transcripción.', 'Optional, with your own Gemini key. The AI only sees the transcript.')}>
          <span className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" /> {t('Corrección con IA', 'AI feedback')}
          </span>
        </SectionTitle>
        {!geminiKey ? (
          <p className="text-sm text-muted">{t('Añade tu API key en Ajustes para activarla.', 'Add your API key in Settings to enable it.')}</p>
        ) : ai.status === 'done' && ai.data ? (
          <AiFeedbackView data={ai.data} ielts={isIelts} />
        ) : ai.status === 'loading' ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin" /> {t('Evaluando…', 'Evaluating…')}
          </p>
        ) : (
          <>
            {ai.error && <Notice tone="bad" className="mb-3">{ai.error}</Notice>}
            <Button variant="outline" onClick={runAi} disabled={!outcome.responses.some((r) => r.transcript)}>
              <Wand2 size={16} /> {t('Corregir con Gemini', 'Grade with Gemini')}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
