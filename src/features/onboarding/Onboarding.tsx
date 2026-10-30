import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, BookOpen, Dumbbell, Timer, LineChart, Check, Upload } from 'lucide-react';
import { useApp, useUi } from '@/store';
import { useT } from '@/i18n';
import { Button, Notice } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { PrefsButtons } from '@/components/layout/AppShell';
import { cn } from '@/lib/cn';
import type { Exam, Skill } from '@/engine/plan';
import { SKILLS } from '@/engine/plan';

const TOEFL_BANDS = [3, 3.5, 4, 4.5, 5, 5.5, 6];
const IELTS_BANDS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

export default function Onboarding() {
  const t = useT();
  const nav = useNavigate();
  const ui = useUi();
  const app = useApp();
  const [step, setStep] = useState(0);
  const [exam, setExam] = useState<Exam>(ui.exam);
  const [name, setName] = useState(app.name);
  const profile = app.profiles[exam];
  const [targets, setTargets] = useState<Record<Skill, number>>(profile.targets);
  const [overall, setOverall] = useState(profile.overallTarget);
  const [date, setDate] = useState(profile.examDate ? new Date(profile.examDate).toISOString().slice(0, 10) : '');
  const [minutes, setMinutes] = useState(app.minutesPerDay);

  const chooseExam = (e: Exam) => {
    setExam(e);
    ui.setExam(e);
    setTargets(app.profiles[e].targets);
    setOverall(app.profiles[e].overallTarget);
    setDate(app.profiles[e].examDate ? new Date(app.profiles[e].examDate!).toISOString().slice(0, 10) : '');
  };

  const presets =
    exam === 'toefl'
      ? [
          { label: 'SJTU (máster)', overall: 4, t: { reading: 4, listening: 4.5, speaking: 4, writing: 4.5 } },
          { label: 'KAIST', overall: 4.5, t: { reading: 4.5, listening: 4.5, speaking: 4.5, writing: 4.5 } },
          { label: 'SJTU + KAIST', overall: 4.5, t: { reading: 4.5, listening: 4.5, speaking: 4.5, writing: 4.5 } },
        ]
      : [
          { label: '7.0 (mín. 6.0)', overall: 7, t: { reading: 7, listening: 7, speaking: 6.5, writing: 6.5 } },
          { label: '6.5', overall: 6.5, t: { reading: 6.5, listening: 6.5, speaking: 6.5, writing: 6 } },
          { label: '7.5', overall: 7.5, t: { reading: 7.5, listening: 7.5, speaking: 7, writing: 7 } },
        ];

  const finish = () => {
    app.updateProfile(exam, { targets, overallTarget: overall, examDate: date ? new Date(date + 'T09:00:00').getTime() : null });
    app.set({ name: name.trim(), minutesPerDay: minutes, onboarded: true });
    nav('/', { replace: true });
  };

  const importFile = async (f: File) => {
    try {
      app.importData(await f.text());
      useApp.setState({ onboarded: true });
      nav('/', { replace: true });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const bands = exam === 'toefl' ? TOEFL_BANDS : IELTS_BANDS;

  const steps = [
    // 0 — examen
    <div key="exam">
      <h1 className="font-display text-[34px] leading-[1.05] font-bold sm:text-[46px]">
        {t('Cruza el umbral', 'Cross the threshold')}
        <br />
        <span className="text-accent">{t('de tu nota.', 'to your score.')}</span>
      </h1>
      <p className="mt-4 max-w-lg text-[15.5px] text-muted">
        {t(
          'Práctica gratuita y fiel al formato real del TOEFL iBT 2026 y del IELTS Academic: simulacros con tiempo, corrección inmediata, vocabulario con repetición espaciada y un plan diario.',
          'Free practice that mirrors the real TOEFL iBT 2026 and IELTS Academic: timed mocks, instant feedback, spaced-repetition vocabulary and a daily plan.',
        )}
      </p>
      <h2 className="mt-8 mb-3 text-sm font-semibold text-muted">{t('¿Qué examen preparas?', 'Which exam are you preparing?')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['toefl', 'TOEFL iBT', t('Formato 2026 · escala 1–6', '2026 format · 1–6 scale'), t('R · L · W · S ≈ 90 min, adaptativo', 'R · L · W · S ≈ 90 min, adaptive')],
            ['ielts', 'IELTS Academic', t('Bandas 0–9', 'Bands 0–9'), t('L · R · W · S ≈ 2 h 45 min', 'L · R · W · S ≈ 2 h 45 min')],
          ] as const
        ).map(([e, title, sub, detail]) => (
          <button
            key={e}
            onClick={() => chooseExam(e)}
            aria-pressed={exam === e}
            className={cn(
              'group relative overflow-hidden rounded-2xl border-2 bg-surface p-5 text-left transition-all',
              exam === e ? 'border-accent shadow-card' : 'border-line hover:border-line-strong',
            )}
          >
            <span className={cn('mb-4 block h-1.5 w-10 rounded-full', e === 'toefl' ? 'bg-toefl' : 'bg-ielts')} />
            <div className="font-display text-xl font-bold">{title}</div>
            <div className="mt-0.5 text-sm text-muted">{sub}</div>
            <div className="mt-3 text-xs text-faint">{detail}</div>
            {exam === e && (
              <span className="absolute top-4 right-4 grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-ink">
                <Check size={14} />
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">{t('Puedes cambiar de examen en cualquier momento desde la barra superior.', 'You can switch exams at any time from the top bar.')}</p>
    </div>,

    // 1 — perfil y objetivo
    <div key="goal" className="space-y-6">
      <div>
        <label htmlFor="name" className="text-sm font-semibold">
          {t('¿Cómo te llamas?', "What's your name?")}
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('Tu nombre (sólo se guarda en este navegador)', 'Your name (stored only in this browser)')}
          className="mt-2 h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] outline-none focus:border-accent"
        />
      </div>
      <div>
        <div className="text-sm font-semibold">{t('Nota objetivo', 'Target score')}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setTargets(p.t as Record<Skill, number>);
                setOverall(p.overall);
              }}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-accent hover:text-accent"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <BandSelect label={t('Global', 'Overall')} value={overall} bands={bands} onChange={setOverall} />
          {SKILLS.map((s) => (
            <BandSelect key={s} label={s[0].toUpperCase() + s.slice(1)} value={targets[s]} bands={bands} onChange={(v) => setTargets({ ...targets, [s]: v })} />
          ))}
        </div>
        {exam === 'toefl' && (
          <Notice tone="accent" className="mt-3">
            {t(
              'SJTU pide 4.0 global con R 4, L 4.5, S 4 y W 4.5; KAIST pide 4.5 global. Las notas de Umbral son estimaciones orientativas.',
              'SJTU requires 4.0 overall with R 4, L 4.5, S 4 and W 4.5; KAIST requires 4.5 overall. Umbral scores are estimates only.',
            )}
          </Notice>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="text-sm font-semibold">
            {t('Fecha del examen', 'Exam date')}
          </label>
          <input
            id="date"
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-faint">{t('Opcional: sin fecha, el plan asume 8 semanas.', 'Optional: without a date the plan assumes 8 weeks.')}</p>
        </div>
        <div>
          <label htmlFor="min" className="text-sm font-semibold">
            {t('Minutos al día', 'Minutes per day')}: <span className="text-accent">{minutes}</span>
          </label>
          <input id="min" type="range" min={15} max={180} step={15} value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="mt-4 w-full accent-[var(--accent)]" />
        </div>
      </div>
    </div>,

    // 2 — tour
    <div key="tour">
      <h2 className="font-display text-3xl font-bold">{t('Así funciona Umbral', 'How Umbral works')}</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          [BookOpen, 'Study Room', t('Guías de cada tarea, vocabulario AWL con flashcards, gramática, conectores y vídeos.', 'Task guides, AWL flashcards, grammar, connectors and videos.')],
          [Dumbbell, t('Práctica', 'Practice'), t('Ejercicios por tipo de pregunta con corrección y explicación inmediatas.', 'Exercises by question type with instant feedback.')],
          [Timer, t('Simulacros', 'Mock tests'), t('Exámenes completos con tiempos reales, adaptatividad (TOEFL) e informe tipo oficial.', 'Full timed tests, adaptivity (TOEFL) and an official-style report.')],
          [LineChart, t('Inicio', 'Home'), t('Tu plan del día, racha, nota estimada y puntos débiles.', 'Your daily plan, streak, estimated score and weak points.')],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof BookOpen;
          return (
            <div key={title as string} className="rounded-2xl border border-line bg-surface p-4">
              <I className="text-accent" size={20} />
              <div className="mt-2 font-semibold">{title as string}</div>
              <p className="mt-1 text-sm text-muted">{text as string}</p>
            </div>
          );
        })}
      </div>
      <Notice className="mt-4">
        {t(
          'Tu progreso se guarda sólo en este navegador. Para usarlo en otro dispositivo, expórtalo en Ajustes y vuelve a importarlo. Las notas son estimaciones orientativas, no oficiales.',
          'Your progress is stored only in this browser. Export it from Settings to use it on another device. Scores are estimates, not official.',
        )}
      </Notice>
    </div>,
  ];

  return (
    <div className="app-bg min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <Logo />
          <PrefsButtons />
        </div>
        <div className="flex flex-1 flex-col justify-center py-8">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} /> {t('Atrás', 'Back')}
              </Button>
            ) : (
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink">
                <Upload size={16} /> {t('Importar progreso', 'Import progress')}
                <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              </label>
            )}
            <div className="ml-2 hidden gap-1.5 sm:flex" aria-hidden>
              {steps.map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-accent' : 'w-1.5 bg-line-strong')} />
              ))}
            </div>
          </div>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} size="lg">
              {t('Continuar', 'Continue')} <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={finish} size="lg">
              {t('Empezar', 'Start')} <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BandSelect({ label, value, bands, onChange }: { label: string; value: number; bands: number[]; onChange: (v: number) => void }) {
  const id = `band-${label}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-line-strong bg-surface px-2.5 font-mono text-[15px] outline-none focus:border-accent"
      >
        {bands.map((b) => (
          <option key={b} value={b}>
            {b.toFixed(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
