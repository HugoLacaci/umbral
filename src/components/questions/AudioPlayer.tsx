import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, Gauge, AlertTriangle } from 'lucide-react';
import type { Audio } from '@/content/schema';
import { playAudio, ttsSupported, estimateDuration, ACCENT_LABEL, type PlayHandle } from '@/engine/tts';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button, Notice } from '@/components/ui';

/**
 * Reproductor de guiones TTS.
 *  - mode "exam": se oye UNA vez, sin pausa ni velocidad (como en el examen real).
 *  - mode "practice": play/pausa (reinicia la línea), repetir y velocidad.
 */
export function AudioPlayer({
  audio,
  mode,
  autoPlay,
  onEnd,
  context,
  compact,
}: {
  audio: Audio;
  mode: 'exam' | 'practice';
  autoPlay?: boolean;
  onEnd?: () => void;
  context?: string;
  compact?: boolean;
}) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle');
  const [line, setLine] = useState(0);
  const [rate, setRate] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const handle = useRef<PlayHandle | null>(null);
  const started = useRef(false);
  const total = estimateDuration(audio, rate);
  const speakers = Object.fromEntries(audio.speakers.map((s) => [s.id, s]));

  const start = (from = 0) => {
    handle.current?.stop();
    setState('playing');
    const h = playAudio(audio, { rate, startAt: from, onLine: setLine });
    handle.current = h;
    h.done
      .then(() => {
        if (handle.current === h && state !== 'paused') {
          setState((s) => (s === 'paused' ? s : 'done'));
          onEnd?.();
        }
      })
      .catch(() => setState('idle'));
  };

  useEffect(() => {
    if (autoPlay && !started.current && ttsSupported()) {
      started.current = true;
      const id = setTimeout(() => start(0), 600);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  useEffect(() => () => handle.current?.stop(), []);

  useEffect(() => {
    if (state !== 'playing') return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  if (!ttsSupported())
    return (
      <Notice tone="bad" icon={<AlertTriangle size={16} />}>
        {t('Tu navegador no tiene síntesis de voz (speechSynthesis). Usa Chrome, Edge o Safari para el Listening.', 'Your browser has no speech synthesis. Use Chrome, Edge or Safari for Listening.')}
      </Notice>
    );

  const current = speakers[audio.lines[Math.min(line, audio.lines.length - 1)]?.s];

  return (
    <div className={cn('rounded-2xl border border-line bg-surface', compact ? 'p-3' : 'p-4')}>
      {context && <p className="mb-3 text-[14px] font-medium">{context}</p>}
      {/* Hablantes (apoyo visual, como en el examen) */}
      <div className="mb-3 flex flex-wrap gap-2">
        {audio.speakers.map((s) => {
          const active = state === 'playing' && current?.id === s.id;
          return (
            <div key={s.id} className={cn('flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors', active ? 'border-accent bg-accent-soft' : 'border-line')}>
              <span className={cn('grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold', active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted')}>
                {s.name.slice(0, 1)}
              </span>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold">{s.name}</div>
                <div className="text-[11px] text-faint">
                  {s.role ? `${s.role} · ` : ''}
                  {mode === 'practice' ? ACCENT_LABEL[s.accent] : ''}
                </div>
              </div>
              {active && <Volume2 size={14} className="animate-pulse text-accent" />}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        {mode === 'practice' ? (
          <>
            {state === 'playing' ? (
              <Button
                size="icon"
                onClick={() => {
                  handle.current?.stop();
                  setState('paused');
                }}
                aria-label={t('Pausa', 'Pause')}
              >
                <Pause size={18} />
              </Button>
            ) : (
              <Button size="icon" onClick={() => start(state === 'paused' ? line : 0)} aria-label={t('Reproducir', 'Play')}>
                <Play size={18} />
              </Button>
            )}
            <Button
              size="icon"
              variant="secondary"
              onClick={() => {
                setElapsed(0);
                start(0);
              }}
              aria-label={t('Desde el principio', 'From the start')}
            >
              <RotateCcw size={16} />
            </Button>
          </>
        ) : (
          state === 'idle' &&
          !autoPlay && (
            <Button onClick={() => start(0)}>
              <Play size={16} /> {t('Reproducir (una sola vez)', 'Play (once only)')}
            </Button>
          )
        )}
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${state === 'done' ? 100 : Math.min(98, (elapsed / Math.max(total, 1)) * 100)}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-faint">
            <span>
              {state === 'playing'
                ? t('Reproduciendo…', 'Playing…')
                : state === 'done'
                  ? t('Audio terminado', 'Audio finished')
                  : state === 'paused'
                    ? t('En pausa', 'Paused')
                    : mode === 'exam'
                      ? t('Se oye una sola vez', 'Heard once only')
                      : t('Listo', 'Ready')}
            </span>
            <span className="font-mono">
              {t('línea', 'line')} {Math.min(line + 1, audio.lines.length)}/{audio.lines.length}
            </span>
          </div>
        </div>
        {mode === 'practice' && (
          <label className="flex items-center gap-1 text-[12px] text-muted">
            <Gauge size={14} />
            <select value={rate} onChange={(e) => setRate(+e.target.value)} className="rounded-md border border-line bg-surface px-1 py-0.5" aria-label={t('Velocidad', 'Speed')}>
              {[0.75, 0.85, 1, 1.15, 1.3].map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
