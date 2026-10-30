import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, CheckCircle2, XCircle, Lightbulb, ChevronDown, Clock, AlertTriangle } from 'lucide-react';
import { useApp, type Attempt } from '@/store';
import { useT, dateFmt, SKILL_LABEL } from '@/i18n';
import { Button, Card, SectionTitle, Badge, Notice, ProgressBar, LoadingBlock } from '@/components/ui';
import { toeflCefr, toeflComparable, SECTION_0_30, toeflOverall, toeflWritingBand } from '@/engine/scoring/toefl';
import { ieltsCefr, ieltsOverall, ieltsWritingBand } from '@/engine/scoring/ielts';
import { QTYPES } from '@/content/schema';
import { BANK_META } from '@/content';
import type { Skill } from '@/engine/plan';
import { loadMock, scopedAnswers, type Mock, type MockSet } from './mock';
import { CtwView, ToeflReadingView, IeltsReadingView, BuildView, Transcript } from '@/components/questions/SetViews';
import { McqView, Feedback, GroupView, numberItems, type Answers } from '@/components/questions/Items';
import { WritingFeedback, type WritingKind } from '@/features/practice/writing/WritingTask';
import type { ToeflCtwSet, ToeflListeningSet, ToeflReadingSet, IeltsListeningPart } from '@/content/schema';
import { cn, fmtTime, pct } from '@/lib/cn';

export default function ExamReport() {
  const t = useT();
  const { id } = useParams();
  const attempt = useApp((s) => s.attempts.find((a) => a.id === id));
  const profile = useApp((s) => (attempt ? s.profiles[attempt.exam] : null));
  const name = useApp((s) => s.name);
  const [mock, setMock] = useState<Mock | null>(null);
  useEffect(() => {
    if (attempt?.kind === 'mock' && attempt.mockNo) loadMock(attempt.exam, attempt.mockNo).then(setMock);
  }, [attempt?.exam, attempt?.mockNo, attempt?.kind]);
  if (!attempt || !profile) return <Notice tone="bad">{t('Resultado no encontrado.', 'Result not found.')}</Notice>;

  const isToefl = attempt.exam === 'toefl';
  const secs = attempt.sections;
  const bands = attempt.bands ?? {};

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/exam" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> {t('Simulacros', 'Mock tests')}
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer size={15} /> {t('Imprimir / PDF', 'Print / PDF')}
        </Button>
      </div>

      {/* Informe con aspecto de score report (sin marcas registradas) */}
      <Card className="overflow-hidden">
        <div className={cn('flex flex-wrap items-end justify-between gap-3 px-6 py-5 text-white', isToefl ? 'bg-[#1d2a8f]' : 'bg-[#074a38]')}>
          <div>
            <div className="text-[11px] tracking-[0.18em] uppercase opacity-75">{t('Informe de resultados · práctica no oficial', 'Score report · unofficial practice')}</div>
            <div className="mt-1 font-display text-2xl font-bold">{attempt.title}</div>
          </div>
          <div className="text-right text-[13px] opacity-90">
            <div>{name || t('Candidato/a', 'Test taker')}</div>
            <div>{dateFmt(attempt.finishedAt, t.lang, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        <div className="p-6">
          {attempt.flexible && (
            <Notice tone="warn" icon={<AlertTriangle size={16} />} className="mb-4">
              {t(`Hecho en modo flexible (${(attempt.detail?.pauses as number) ?? 0} pausas): el tiempo no fue el real.`, `Taken in flexible mode (${(attempt.detail?.pauses as number) ?? 0} pauses): timing was not real.`)}
            </Notice>
          )}
          <div className={cn('grid gap-3', secs.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2')}>
            {secs.map((s) => (
              <ScoreBox key={s} label={t.x(SKILL_LABEL[s])} band={bands[s]} isToefl={isToefl} sub={isToefl && bands[s] !== undefined ? `≈ ${SECTION_0_30[s][String(bands[s])]} /30` : (attempt.detail?.[`${s}Raw`] as string | undefined)} />
            ))}
            {attempt.overall !== undefined && (
              <div className={cn('rounded-2xl p-4 text-white', isToefl ? 'bg-[#2433b0]' : 'bg-[#095c45]')}>
                <div className="text-[12px] font-semibold tracking-wide uppercase opacity-80">{isToefl ? t('Total (1–6)', 'Total (1–6)') : 'Overall band'}</div>
                <div className="font-display text-5xl font-bold">{attempt.overall.toFixed(1)}</div>
                <div className="mt-1 text-[12.5px] opacity-90">
                  {isToefl ? (
                    <>
                      MCER {toeflCefr(attempt.overall)} · {t('0–120 comparable', 'comparable 0–120')}: <strong>{toeflComparable(attempt.overall).label}</strong>
                    </>
                  ) : (
                    <>MCER ≈ {ieltsCefr(attempt.overall)}</>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="mt-4 text-[12px] text-faint">
            {isToefl
              ? t('Escala 1–6 en saltos de 0,5. Total = media de las cuatro secciones redondeada al 0,5 más cercano. El rango 0–120 sigue la tabla de concordancia de ETS (2026). Las bandas de sección son estimaciones de Umbral, no oficiales.', '1–6 scale in 0.5 steps. Total = average of the four sections rounded to the nearest 0.5. The 0–120 range follows ETS’s 2026 concordance table. Section bands are Umbral estimates, not official.')
              : t('Bandas 0–9. Global = media redondeada (,25 sube a ,5; ,75 sube a la banda siguiente). Listening y Reading usan una tabla aproximada de aciertos; Writing y Speaking son estimaciones automáticas.', 'Bands 0–9. Overall = rounded average (.25 → .5; .75 → next band). Listening and Reading use an approximate raw-score table; Writing and Speaking are automatic estimates.')}
          </p>
        </div>
      </Card>

      <Requirements attempt={attempt} reqs={profile.requirements} />
      <Recommendations attempt={attempt} />
      <TypeBreakdown attempt={attempt} />
      <TimeTable attempt={attempt} mock={mock} />
      <WritingRefine attempt={attempt} mock={mock} />
      <Review attempt={attempt} mock={mock} />
    </div>
  );
}

function ScoreBox({ label, band, isToefl, sub }: { label: string; band?: number; isToefl: boolean; sub?: string }) {
  const max = isToefl ? 6 : 9;
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="text-[12px] font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="font-display text-4xl font-bold">{band !== undefined ? band.toFixed(1) : '—'}</div>
      {band !== undefined && <ProgressBar value={band - (isToefl ? 1 : 0)} max={max - (isToefl ? 1 : 0)} className="mt-2" />}
      <div className="mt-1.5 text-[12px] text-faint">
        {band !== undefined && (isToefl ? `MCER ${toeflCefr(band)}` : `MCER ≈ ${ieltsCefr(band)}`)}
        {sub && ` · ${sub}`}
      </div>
    </div>
  );
}

/* ─────────── Requisitos ─────────── */

function Requirements({ attempt, reqs }: { attempt: Attempt; reqs: { id: string; name: string; overall: number; sections: Partial<Record<Skill, number>> }[] }) {
  const t = useT();
  const b = attempt.bands ?? {};
  if (!reqs.length) return null;
  return (
    <Card className="mt-5 p-5">
      <SectionTitle sub={t('Comparación con tus objetivos (edítalos en Ajustes).', 'Compared with your targets (edit in Settings).')}>{t('¿Cumples los requisitos?', 'Do you meet the requirements?')}</SectionTitle>
      <div className="space-y-3">
        {reqs.map((r) => {
          const parts: { label: string; ok: boolean; gap: number }[] = [];
          if (attempt.overall !== undefined) parts.push({ label: t('Global', 'Overall'), ok: attempt.overall >= r.overall, gap: r.overall - attempt.overall });
          for (const [s, v] of Object.entries(r.sections) as [Skill, number][]) if (b[s] !== undefined) parts.push({ label: s[0].toUpperCase(), ok: b[s]! >= v, gap: v - b[s]! });
          const missing = parts.filter((p) => !p.ok);
          const allOk = parts.length > 0 && missing.length === 0;
          return (
            <div key={r.id} className={cn('rounded-xl border p-3.5', allOk ? 'border-good/40 bg-good-soft' : 'border-line')}>
              <div className="flex flex-wrap items-center gap-2">
                {allOk ? <CheckCircle2 size={18} className="text-good" /> : <XCircle size={18} className="text-bad" />}
                <span className="font-semibold">{r.name}</span>
                <span className="text-xs text-muted">
                  {t('Global', 'Overall')} {r.overall.toFixed(1)}
                  {Object.entries(r.sections).map(([s, v]) => ` · ${s[0].toUpperCase()} ${v!.toFixed(1)}`)}
                </span>
              </div>
              <p className="mt-1 text-sm">
                {parts.length === 0
                  ? t('Haz un simulacro completo para compararlo.', 'Take a full mock to compare.')
                  : allOk
                    ? t('Cumples todos los requisitos con este resultado.', 'You meet every requirement with this result.')
                    : `${t('Cumples', 'You meet')} ${parts.filter((p) => p.ok).map((p) => p.label).join(', ') || '—'}; ${t('te falta', 'you are short')} ${missing.map((m) => `${m.gap.toFixed(1)} ${t('en', 'in')} ${m.label}`).join(', ')}.`}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─────────── Recomendaciones ─────────── */

function Recommendations({ attempt }: { attempt: Attempt }) {
  const t = useT();
  const byType = useMemo(() => typeStats(attempt), [attempt]);
  const weakTypes = byType.filter((x) => x.max >= 2 && x.rate < 0.7).sort((a, b) => a.rate - b.rate).slice(0, 4);
  const b = attempt.bands ?? {};
  const weakestSec = (Object.entries(b) as [Skill, number][]).sort((x, y) => x[1] - y[1])[0]?.[0];
  const practice = BANK_META.filter((m) => m.exam === attempt.exam && m.section === weakestSec);
  return (
    <Card className="mt-5 p-5">
      <SectionTitle>
        <span className="flex items-center gap-2">
          <Lightbulb size={18} className="text-xp" /> {t('Qué estudiar ahora', 'What to study next')}
        </span>
      </SectionTitle>
      <ul className="space-y-2.5 text-[14px]">
        {weakTypes.map((w) => {
          const meta = QTYPES[w.qtype];
          return (
            <li key={w.qtype} className="flex flex-wrap items-center gap-2">
              <Badge tone="bad">{pct(w.earned, w.max)} %</Badge>
              <span>
                {t('Repasa', 'Review')} <strong>{meta ? t.x(meta) : w.qtype}</strong>
              </span>
              {meta?.lesson && (
                <Link className="font-medium text-accent hover:underline" to={`/study/lesson/${meta.lesson}`}>
                  {t('→ guía', '→ guide')}
                </Link>
              )}
            </li>
          );
        })}
        {weakestSec && (
          <li className="flex flex-wrap items-center gap-2">
            <Badge tone="warn">{weakestSec}</Badge>
            {t('Tu sección más floja. Practica:', 'Your weakest section. Practise:')}
            {practice.map((p) => (
              <Link key={p.key} to={`/practice/${p.key}`} className="font-medium text-accent hover:underline">
                {p.title}
              </Link>
            ))}
          </li>
        )}
        <li className="flex items-center gap-2">
          <Badge>SRS</Badge>
          <Link to="/study/vocab" className="text-accent hover:underline">
            {t('Repasa tus flashcards a diario (AWL y vocabulario temático)', 'Review your flashcards daily (AWL and topic vocabulary)')}
          </Link>
        </li>
      </ul>
    </Card>
  );
}

function typeStats(a: Attempt) {
  const m = new Map<string, { earned: number; max: number; n: number }>();
  for (const it of a.items) {
    if (/^(toefl|ielts)\./.test(it.qtype)) continue; // tareas productivas
    const e = m.get(it.qtype) ?? { earned: 0, max: 0, n: 0 };
    e.earned += it.earned;
    e.max += it.max;
    e.n++;
    m.set(it.qtype, e);
  }
  return [...m.entries()].map(([qtype, v]) => ({ qtype, ...v, rate: v.max ? v.earned / v.max : 0 }));
}

function TypeBreakdown({ attempt }: { attempt: Attempt }) {
  const t = useT();
  const rows = typeStats(attempt).sort((a, b) => a.rate - b.rate);
  if (!rows.length) return null;
  return (
    <Card className="mt-5 p-5">
      <SectionTitle>{t('Desglose por tipo de pregunta', 'Breakdown by question type')}</SectionTitle>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.qtype} className="grid grid-cols-[1fr_120px_64px] items-center gap-3 text-[13.5px] sm:grid-cols-[1fr_200px_64px]">
            <span className="truncate">{QTYPES[r.qtype] ? t.x(QTYPES[r.qtype]) : r.qtype}</span>
            <ProgressBar value={r.earned} max={r.max} tone={r.rate >= 0.75 ? 'good' : r.rate >= 0.5 ? 'warn' : 'bad'} />
            <span className="text-right font-mono text-[12.5px]">
              {r.earned}/{r.max}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function setsOf(mock: Mock, attempt: Attempt): { section: Skill; ms: MockSet }[] {
  const out: { section: Skill; ms: MockSet }[] = [];
  const path = (attempt.detail?.path ?? {}) as Record<string, 'lower' | 'upper'>;
  if (mock.exam === 'toefl') {
    for (const s of ['reading', 'listening'] as const)
      if (attempt.sections.includes(s)) [...mock[s].router, ...(path[s] ? mock[s][path[s]] : [])].forEach((ms) => out.push({ section: s, ms }));
    if (attempt.sections.includes('writing')) mock.build.forEach((b) => out.push({ section: 'writing', ms: { bank: 'toefl.build', set: b } }));
  } else {
    if (attempt.sections.includes('listening')) mock.listening.forEach((p) => out.push({ section: 'listening', ms: { bank: 'ielts.listening', set: p } }));
    if (attempt.sections.includes('reading')) mock.reading.forEach((p) => out.push({ section: 'reading', ms: { bank: 'ielts.reading', set: p } }));
  }
  return out;
}

function TimeTable({ attempt, mock }: { attempt: Attempt; mock: Mock | null }) {
  const t = useT();
  const timings = (attempt.detail?.timings ?? {}) as Record<string, number>;
  if (!mock || !Object.keys(timings).length) return null;
  const rows = setsOf(mock, attempt).filter((x) => timings[x.ms.set.id]);
  const nQ = (ms: MockSet) => attempt.items.filter((i) => i.qid.startsWith(ms.set.id)).length || 1;
  return (
    <Card className="mt-5 p-5">
      <SectionTitle sub={t('Tiempo que pasaste en cada bloque y media por pregunta.', 'Time spent per block and average per question.')}>
        <span className="flex items-center gap-2">
          <Clock size={18} className="text-accent" /> {t('Tiempo empleado', 'Time spent')}
        </span>
      </SectionTitle>
      <div className="grid gap-x-6 gap-y-1.5 text-[13px] md:grid-cols-2">
        {rows.map(({ ms, section }) => (
          <div key={ms.set.id} className="flex justify-between gap-3 border-b border-line py-1">
            <span className="truncate text-muted">
              {section} · {(ms.set as { title?: string }).title ?? ms.set.id}
            </span>
            <span className="shrink-0 font-mono">
              {fmtTime(timings[ms.set.id])} · {Math.round(timings[ms.set.id] / nQ(ms))} s/q
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─────────── Writing: refinar con LanguageTool/autoevaluación ─────────── */

function WritingRefine({ attempt, mock }: { attempt: Attempt; mock: Mock | null }) {
  const t = useT();
  const saveAttempt = useApp((s) => s.saveAttempt);
  const texts = (attempt.detail?.texts ?? {}) as Record<string, string>;
  const [open, setOpen] = useState(false);
  if (!mock || !attempt.sections.includes('writing')) return null;
  const tasks: { key: string; kind: WritingKind; task: never }[] =
    mock.exam === 'toefl'
      ? [
          { key: 'email', kind: 'toefl.email', task: mock.email as never },
          { key: 'discussion', kind: 'toefl.discussion', task: mock.discussion as never },
        ]
      : [
          { key: 'task1', kind: 'ielts.task1', task: mock.task1 as never },
          { key: 'task2', kind: 'ielts.task2', task: mock.task2 as never },
        ];
  const update = (key: string, score: number) => {
    const ws = { ...((attempt.detail?.writingScores ?? {}) as Record<string, number>), [key]: score };
    let band: number;
    if (mock.exam === 'toefl') {
      const build = attempt.items.filter((i) => i.qtype === 'build');
      band = toeflWritingBand(build.filter((i) => i.correct).length, build.length, ws.email ?? 0, ws.discussion ?? 0);
    } else band = ieltsWritingBand(ws.task1 ?? 0, ws.task2 ?? 0);
    const bands = { ...attempt.bands, writing: band };
    const vals = attempt.sections.map((s) => bands[s]).filter((x): x is number => x !== undefined);
    const overall = vals.length === 4 ? (mock.exam === 'toefl' ? toeflOverall(vals) : ieltsOverall(vals)) : attempt.overall;
    if (bands.writing === attempt.bands?.writing && JSON.stringify(ws) === JSON.stringify(attempt.detail?.writingScores)) return;
    saveAttempt({ ...attempt, bands, overall, detail: { ...attempt.detail, writingScores: ws } });
  };
  return (
    <Card className="mt-5 p-5">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <SectionTitle sub={t('Corrige tus textos con LanguageTool, la checklist y tu autoevaluación: la nota de Writing se recalcula.', 'Check your texts with LanguageTool, the checklist and self-assessment: the Writing score is recalculated.')}>
          {t('Revisar Writing en detalle', 'Review Writing in detail')}
        </SectionTitle>
        <ChevronDown className={cn('shrink-0 transition-transform', open && 'rotate-180')} size={18} />
      </button>
      {open && (
        <div className="mt-3 space-y-8">
          {tasks.map((x) => (
            <div key={x.key}>
              <h3 className="mb-2 text-lg font-semibold">{x.kind}</h3>
              {texts[x.key]?.trim() ? <WritingFeedback kind={x.kind} task={x.task} text={texts[x.key]} onResult={(r) => update(x.key, r.score)} /> : <Notice>{t('No escribiste nada en esta tarea.', 'You wrote nothing for this task.')}</Notice>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ─────────── Revisión pregunta a pregunta ─────────── */

function Review({ attempt, mock }: { attempt: Attempt; mock: Mock | null }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  if (!mock) return attempt.kind === 'mock' ? <div className="mt-5"><LoadingBlock /></div> : null;
  const answers = (attempt.detail?.answers ?? {}) as Record<string, never>;
  const sets = setsOf(mock, attempt);
  const speaking = (attempt.detail?.speaking ?? []) as { kind: string; responses: { prompt: string; transcript: string; wpm: number; accuracy?: number; score?: number }[] }[];
  return (
    <Card className="mt-5 p-5">
      <SectionTitle sub={t('Pulsa un bloque para ver tus respuestas, la correcta, la explicación y la frase que la justifica.', 'Open a block to see your answers, the correct one, the explanation and the supporting sentence.')}>{t('Revisión pregunta a pregunta', 'Question-by-question review')}</SectionTitle>
      <div className="space-y-2">
        {sets.map(({ ms, section }) => {
          const its = attempt.items.filter((i) => i.qid.startsWith(`${ms.set.id}#`) || i.qid === ms.set.id);
          const e = its.reduce((s, i) => s + i.earned, 0);
          const m = its.reduce((s, i) => s + i.max, 0);
          const isOpen = open === ms.set.id;
          const sc = scopedAnswers(answers, ms.set.id);
          return (
            <div key={ms.set.id} className="rounded-xl border border-line">
              <button className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left" onClick={() => setOpen(isOpen ? null : ms.set.id)} aria-expanded={isOpen}>
                <Badge>{section}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{(ms.set as { title?: string }).title ?? (ms.set as { context?: { text: string } }).context?.text ?? ms.set.id}</span>
                <span className={cn('font-mono text-sm', m && e / m >= 0.7 ? 'text-good' : 'text-bad')}>
                  {e}/{m}
                </span>
                <ChevronDown size={16} className={cn('transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="border-t border-line p-4">
                  <ReviewSet ms={ms} answers={sc} />
                </div>
              )}
            </div>
          );
        })}
        {speaking.map((s, k) => (
          <details key={k} className="rounded-xl border border-line px-3.5 py-2.5">
            <summary className="cursor-pointer text-sm font-medium">
              Speaking · {s.kind} {s.responses.some((r) => r.score !== undefined) && `· ${s.responses.reduce((x, r) => x + (r.score ?? 0), 0)}/${s.responses.length * 5}`}
            </summary>
            <ul className="mt-2 space-y-2 text-[13.5px]">
              {s.responses.map((r, i) => (
                <li key={i}>
                  <div className="font-medium">{r.prompt.split('\n')[0]}</div>
                  <div className="text-muted italic">{r.transcript || '—'}</div>
                  <div className="text-xs text-faint">
                    {r.wpm} wpm {r.accuracy !== undefined && `· ${Math.round(r.accuracy * 100)} %`} {r.score !== undefined && `· ${r.score}/5`}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </Card>
  );
}

function ReviewSet({ ms, answers }: { ms: MockSet; answers: Answers }) {
  const noop = () => undefined;
  switch (ms.bank) {
    case 'toefl.ctw':
      return <CtwView set={ms.set as ToeflCtwSet} answers={answers} setAnswer={noop} reveal />;
    case 'toefl.daily':
    case 'toefl.passage':
      return <ToeflReadingView set={ms.set as ToeflReadingSet} answers={answers} setAnswer={noop} reveal />;
    case 'toefl.build': {
      const it = ms.set as never as { id: string };
      return <BuildView item={ms.set as never} value={answers[it.id]} onChange={noop} reveal />;
    }
    case 'ielts.reading':
      return <IeltsReadingView passage={ms.set as never} answers={answers} setAnswer={noop} reveal />;
    case 'ielts.listening': {
      const p = ms.set as IeltsListeningPart;
      const numbers = numberItems(p.groups, Number(p.groups[0]?.items[0]?.id.replace(/\D/g, '')) || 1);
      const ev = p.groups.flatMap((g) => g.items.map((i) => i.evidence ?? '')).filter(Boolean);
      return (
        <div className="space-y-6">
          {p.groups.map((g) => (
            <GroupView key={g.id} group={g} answers={answers} setAnswer={noop} numbers={numbers} reveal />
          ))}
          <Transcript audio={p.audio} evidence={ev} />
        </div>
      );
    }
    default: {
      const s = ms.set as ToeflListeningSet;
      return (
        <div className="space-y-5">
          {s.questions.map((q) => (
            <div key={q.id}>
              <McqView item={q} value={answers[q.id]} onChange={noop} reveal />
              <Feedback item={q} value={answers[q.id]} />
            </div>
          ))}
          <Transcript audio={s.audio} evidence={s.questions.map((q) => q.evidence ?? '').filter(Boolean)} />
        </div>
      );
    }
  }
}
