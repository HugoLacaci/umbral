import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Clock } from 'lucide-react';
import { cn, fmtTime } from '@/lib/cn';
import { useT } from '@/i18n';

/**
 * Cuenta atrás basada en un instante de fin (sobrevive a recargas si se persiste `endsAt`).
 * Si `paused` se detiene (sólo en modo flexible / práctica).
 */
export function useCountdown(endsAt: number | null, onExpire?: () => void, paused = false) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
  }, [endsAt]);
  useEffect(() => {
    if (!endsAt || paused) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt, paused]);
  const left = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (endsAt && left <= 0 && !fired.current && !paused) {
      fired.current = true;
      onExpire?.();
    }
  }, [left, endsAt, onExpire, paused]);
  return left;
}

export function TimerDisplay({ seconds, dark, label, warnAt = 300 }: { seconds: number; dark?: boolean; label?: string; warnAt?: number }) {
  const t = useT();
  const [hidden, setHidden] = useState(false);
  const warn = seconds <= warnAt;
  return (
    <div className="flex items-center gap-1.5" role="timer" aria-live="off" aria-label={label ?? t('Tiempo restante', 'Time remaining')}>
      {!hidden && (
        <span className={cn('flex items-center gap-1.5 font-mono text-[15px] font-bold tabular-nums', warn ? (dark ? 'text-amber-300' : 'text-bad') : dark ? 'text-white' : 'text-ink')}>
          <Clock size={15} /> {fmtTime(seconds)}
        </span>
      )}
      <button
        onClick={() => setHidden((h) => !h)}
        className={cn('rounded-md p-1 text-[12px]', dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-surface-2')}
        aria-label={hidden ? t('Mostrar temporizador', 'Show timer') : t('Ocultar temporizador', 'Hide timer')}
      >
        {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
    </div>
  );
}

/** Cronómetro simple para práctica (cuenta hacia arriba o hacia abajo desde un objetivo). */
export function PracticeClock({ minutes }: { minutes: number }) {
  const [start] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.round((now - start) / 1000);
  const left = minutes * 60 - elapsed;
  return <TimerDisplay seconds={Math.abs(left)} label="clock" warnAt={left < 0 ? 999999 : 60} />;
}
