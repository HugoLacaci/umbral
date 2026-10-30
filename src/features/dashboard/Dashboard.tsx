import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CalendarDays, Flame, Clock, Sparkles, CheckCircle2, Circle, ArrowRight, Target, TriangleAlert, Trophy, Timer } from 'lucide-react';
import { useApp, useUi, streak, totalMinutes, currentEstimates, qtypeStats } from '@/store';
import { useT, dateFmt, SKILL_LABEL } from '@/i18n';
import { Card, PageHeader, SectionTitle, Stat, Badge, Button, EmptyState, ProgressBar } from '@/components/ui';
import { buildPlan, dayKey, SKILLS } from '@/engine/plan';
import { QTYPES } from '@/content/schema';
import { toeflOverall, toeflCefr, toeflComparable } from '@/engine/scoring/toefl';
import { ieltsOverall } from '@/engine/scoring/ielts';
import { cn } from '@/lib/cn';
import { achievements } from './achievements';

const DAY = 86_400_000;

export default function Dashboard() {
  const t = useT();
  const exam = useUi((s) => s.exam);
  const app = useApp();
  const profile = app.profiles[exam];
  const examDate = profile.examDate ?? Date.now() + 56 * DAY;
  const est = useMemo(() => currentEstimates(app.attempts, exam), [app.attempts, exam]);
  const plan = useMemo(
    () => buildPlan({ exam, examDate, targets: profile.targets, current: est, minutesPerDay: app.minutesPerDay }),
    // el plan del día sólo cambia con el día, el examen y las estimaciones
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exam, examDate, JSON.stringify(profile.targets), JSON.stringify(est), app.minutesPerDay, dayKey(Date.now())],
  );
  const done = app.tasksDone[dayKey(Date.now())] ?? [];
  const days = streak(app.activity);
  const minutes = totalMinutes(app.activity);
  const todayMin = app.activity[dayKey(Date.now())] ?? 0;
  const weak = useMemo(
    () =>
      qtypeStats(app.attempts, exam)
        .filter((q) => q.seen >= 3)
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 5),
    [app.attempts, exam],
  );
  const mocks = app.attempts.filter((a) => a.exam === exam && a.overall !== undefined).sort((a, b) => a.finishedAt - b.finishedAt);
  const isToefl = exam === 'toefl';
  const estKnown = SKILLS.filter((s) => est[s] !== undefined);
  const overallEst = estKnown.length === 4 ? (isToefl ? toeflOverall(SKILLS.map((s) => est[s]!)) : ieltsOverall(SKILLS.map((s) => est[s]!))) : null;
  const max = isToefl ? 6 : 9;
  const radar = SKILLS.map((s) => ({ skill: t.x(SKILL_LABEL[s]), target: profile.targets[s], current: est[s] ?? 0 }));
  const ach = achievements(app);
  const hour = new Date().getHours();
  const greeting = hour < 13 ? t('Buenos días', 'Good morning') : hour < 20 ? t('Buenas tardes', 'Good afternoon') : t('Buenas noches', 'Good evening');

  return (
    <div>
      <PageHeader
        eyebrow={isToefl ? 'TOEFL iBT · 2026' : 'IELTS Academic'}
        title={`${greeting}${app.name ? `, ${app.name}` : ''}`}
        sub={
          profile.examDate
            ? t(`Quedan ${plan.daysLeft} días para tu examen (${dateFmt(examDate, 'es')}).`, `${plan.daysLeft} days to your exam (${dateFmt(examDate, 'en')}).`)
            : t('Aún no has puesto la fecha del examen: el plan asume 8 semanas.', "You haven't set an exam date yet: the plan assumes 8 weeks.")
        }
        actions={
          <Link to="/exam">
            <Button>
              <Timer size={16} /> {t('Hacer un simulacro', 'Take a mock test')}
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: <CalendarDays size={18} />, label: t('Cuenta atrás', 'Countdown'), value: profile.examDate ? `${plan.daysLeft} d` : '—', sub: profile.examDate ? dateFmt(examDate, t.lang) : t('sin fecha', 'no date') },
          { icon: <Flame size={18} className="text-xp" />, label: t('Racha', 'Streak'), value: `${days}`, sub: t('días seguidos', 'days in a row') },
          { icon: <Clock size={18} />, label: t('Estudiado', 'Studied'), value: minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60}` : `${minutes} min`, sub: t(`hoy ${todayMin} / ${app.minutesPerDay} min`, `today ${todayMin} / ${app.minutesPerDay} min`) },
          { icon: <Sparkles size={18} className="text-accent" />, label: 'XP', value: app.xp, sub: t(`nivel ${Math.floor(app.xp / 500) + 1}`, `level ${Math.floor(app.xp / 500) + 1}`) },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="p-4">
              <Stat {...s} />
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* Plan de hoy */}
        <Card className="p-5">
          <SectionTitle
            sub={t(
              `Fase: ${plan.phase === 'foundation' ? 'fundamentos' : plan.phase === 'practice' ? 'práctica intensiva' : 'simulacros'} · prioridad: ${plan.focus.slice(0, 2).map((s) => SKILL_LABEL[s].es).join(' y ')}`,
              `Phase: ${plan.phase === 'foundation' ? 'foundations' : plan.phase === 'practice' ? 'intensive practice' : 'mock tests'} · focus: ${plan.focus.slice(0, 2).map((s) => SKILL_LABEL[s].en).join(' & ')}`,
            )}
            action={<Badge tone="accent">{done.filter((d) => plan.today.some((x) => x.id === d)).length}/{plan.today.length}</Badge>}
          >
            {t('Plan de hoy', "Today's plan")}
          </SectionTitle>
          <ul className="divide-y divide-line">
            {plan.today.map((task) => {
              const isDone = done.includes(task.id);
              return (
                <li key={task.id} className="flex items-center gap-3 py-2.5">
                  <button
                    onClick={() => app.toggleTask(task.id)}
                    aria-pressed={isDone}
                    aria-label={isDone ? t('Desmarcar tarea', 'Unmark task') : t('Marcar tarea como hecha', 'Mark task done')}
                    className={cn('shrink-0 transition-colors', isDone ? 'text-good' : 'text-faint hover:text-accent')}
                  >
                    {isDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-[14.5px] font-medium', isDone && 'text-faint line-through')}>{t.x(task.title)}</div>
                    <div className="text-xs text-faint">{task.minutes} min</div>
                  </div>
                  <Link to={task.to} className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-accent hover:bg-accent-soft">
                    {t('Ir', 'Go')} <ArrowRight size={14} />
                  </Link>
                </li>
              );
            })}
          </ul>
          <details className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-muted">{t(`Plan por semanas (${plan.weeks.length})`, `Weekly plan (${plan.weeks.length})`)}</summary>
            <ol className="mt-2 space-y-2">
              {plan.weeks.map((w) => (
                <li key={w.index} className="flex gap-3">
                  <span className="w-16 shrink-0 font-mono text-xs text-faint">
                    {t('Sem.', 'Wk')} {w.index + 1}
                  </span>
                  <div>
                    <Badge tone={w.phase === 'exam' ? 'bad' : w.phase === 'practice' ? 'accent' : 'neutral'}>
                      {w.phase === 'foundation' ? t('Fundamentos', 'Foundations') : w.phase === 'practice' ? t('Práctica', 'Practice') : t('Simulacros', 'Mocks')}
                    </Badge>
                    <span className="ml-2 text-[13px] text-muted">{w.goals.join(' · ')}</span>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        </Card>

        {/* Nota estimada vs objetivo */}
        <Card className="p-5">
          <SectionTitle
            sub={t('Estimación a partir de tus últimos intentos (los simulacros pesan más).', 'Estimated from your recent attempts (mocks weigh more).')}
            action={
              overallEst !== null && (
                <div className="text-right">
                  <div className="font-display text-2xl font-bold text-accent">{overallEst.toFixed(1)}</div>
                  <div className="text-[11px] text-faint">
                    {isToefl ? `${toeflCefr(overallEst)} · ≈${toeflComparable(overallEst).label}/120` : t('global', 'overall')}
                  </div>
                </div>
              )
            }
          >
            {t('Nota estimada', 'Estimated score')}
          </SectionTitle>
          {estKnown.length === 0 ? (
            <EmptyState icon={<Target size={24} />} title={t('Aún sin datos', 'No data yet')} action={<Link to="/practice"><Button variant="outline" size="sm">{t('Empezar a practicar', 'Start practising')}</Button></Link>}>
              {t('Haz ejercicios o un simulacro y aquí verás tu nota por destreza frente a tu objetivo.', 'Do some exercises or a mock and your per-skill score will appear here against your target.')}
            </EmptyState>
          ) : (
            <>
              <div className="h-56" aria-hidden>
                <ResponsiveContainer>
                  <RadarChart data={radar} outerRadius="72%">
                    <PolarGrid stroke="var(--line)" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
                    <Radar name="target" dataKey="target" stroke="var(--faint)" strokeDasharray="4 3" fill="transparent" />
                    <Radar name="current" dataKey="current" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.22} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-2.5">
                {SKILLS.map((s) => {
                  const cur = est[s];
                  const tgt = profile.targets[s];
                  const ok = cur !== undefined && cur >= tgt;
                  return (
                    <li key={s} className="grid grid-cols-[84px_1fr_76px] items-center gap-3 text-sm">
                      <span className="font-medium">{t.x(SKILL_LABEL[s])}</span>
                      <ProgressBar value={cur ?? 0} max={max} tone={cur === undefined ? 'accent' : ok ? 'good' : 'warn'} label={`${s} ${cur ?? '-'} / ${tgt}`} />
                      <span className="text-right font-mono text-[13px]">
                        <span className={cn(ok ? 'text-good' : cur !== undefined ? 'text-warn' : 'text-faint')}>{cur?.toFixed(1) ?? '—'}</span>
                        <span className="text-faint"> / {tgt.toFixed(1)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card className="p-5">
          <SectionTitle sub={t('Evolución de la nota global en simulacros y prácticas completas.', 'Overall score trend across mocks.')}>{t('Historial de simulacros', 'Mock history')}</SectionTitle>
          {mocks.length < 1 ? (
            <EmptyState icon={<Trophy size={24} />} title={t('Sin simulacros todavía', 'No mocks yet')} action={<Link to="/exam"><Button size="sm">{t('Ver simulacros', 'See mock tests')}</Button></Link>}>
              {t('Tu primer simulacro marcará el punto de partida.', 'Your first mock sets your baseline.')}
            </EmptyState>
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={mocks.map((m) => ({ d: dateFmt(m.finishedAt, t.lang, { day: 'numeric', month: 'short' }), v: m.overall }))} margin={{ left: -20, right: 10, top: 10 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="d" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis domain={[isToefl ? 1 : 0, max]} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10 }} />
                  <Line type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4 }} name={t('Global', 'Overall')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle sub={t('Tipos de pregunta donde más fallas (mín. 3 intentos).', 'Question types you miss most (min. 3 tries).')}>{t('Puntos débiles', 'Weak points')}</SectionTitle>
          {weak.length === 0 ? (
            <p className="text-sm text-muted">{t('Cuando tengas suficientes respuestas, verás aquí, por ejemplo, «fallas el 40 % de los Not Given».', 'Once you have enough answers you will see e.g. "you miss 40% of Not Given".')}</p>
          ) : (
            <ul className="space-y-3">
              {weak.map((w) => {
                const meta = QTYPES[w.qtype];
                const miss = Math.round((1 - w.rate) * 100);
                return (
                  <li key={w.qtype} className="flex items-center gap-3">
                    <TriangleAlert size={16} className={miss >= 40 ? 'text-bad' : 'text-warn'} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{meta ? t.x(meta) : w.qtype}</div>
                      <div className="text-xs text-muted">{t(`Fallas el ${miss} % (${w.seen - w.correct}/${w.seen})`, `You miss ${miss}% (${w.seen - w.correct}/${w.seen})`)}</div>
                    </div>
                    {meta?.lesson && (
                      <Link to={`/study/lesson/${meta.lesson}`} className="text-[13px] font-medium text-accent hover:underline">
                        {t('Estudiar', 'Study')}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 text-xs font-semibold text-muted uppercase">{t('Logros', 'Achievements')}</div>
            <div className="flex flex-wrap gap-2">
              {ach.map((a) => (
                <span
                  key={a.id}
                  title={t.x(a.desc)}
                  className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs', a.unlocked ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line text-faint')}
                >
                  <span aria-hidden>{a.icon}</span> {t.x(a.title)}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <p className="mt-6 text-center text-xs text-faint">
        {t('Todas las notas de Umbral son estimaciones orientativas, no oficiales.', 'All Umbral scores are unofficial estimates.')}
      </p>
    </div>
  );
}
