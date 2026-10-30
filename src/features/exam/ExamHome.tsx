import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Timer, BookOpen, Headphones, PenLine, Mic, RotateCcw, Play, Trash2, FileBarChart } from 'lucide-react';
import { useApp, useUi } from '@/store';
import { useT, dateFmt } from '@/i18n';
import { Button, Card, PageHeader, Switch, Notice, Badge, SectionTitle } from '@/components/ui';
import type { ExamState, Scope } from './mock';
import { useBank } from '@/content';
import { cn } from '@/lib/cn';

const SECTIONS = [
  { k: 'reading', icon: BookOpen },
  { k: 'listening', icon: Headphones },
  { k: 'writing', icon: PenLine },
  { k: 'speaking', icon: Mic },
] as const;

export default function ExamHome() {
  const t = useT();
  const nav = useNavigate();
  const exam = useUi((s) => s.exam);
  const { drafts, clearDraft, attempts } = useApp();
  const [flex, setFlex] = useState(false);
  const isToefl = exam === 'toefl';
  const order = isToefl ? SECTIONS : [SECTIONS[1], SECTIONS[0], SECTIONS[2], SECTIONS[3]];
  const inProgress = Object.entries(drafts).filter(([k]) => k.startsWith(`exam:${exam}:`)) as [string, ExamState][];
  const past = attempts.filter((a) => a.exam === exam && a.kind === 'mock').sort((a, b) => b.finishedAt - a.finishedAt);

  // Simulacros disponibles: los números de mock presentes en el contenido
  const { data: toeflKey } = useBank('toefl.email');
  const { data: ieltsKey } = useBank('ielts.task2');
  const mocks = [...new Set(((isToefl ? toeflKey : ieltsKey) ?? []).map((x) => x.mock).filter((n): n is number => !!n))].sort((a, b) => a - b);

  const go = (mock: number, scope: Scope) => nav(`/exam/run/${exam}/${mock}/${scope}${flex ? '?flex=1' : ''}`);

  return (
    <div>
      <PageHeader
        eyebrow="Exam Mode"
        title={t('Simulacros con condiciones reales', 'Mock tests under real conditions')}
        sub={
          isToefl
            ? t('Orden oficial (Reading → Listening → Writing → Speaking), Reading y Listening adaptativos en dos módulos, tiempos reales, sin ayudas ni transcripciones.', 'Official order (Reading → Listening → Writing → Speaking), adaptive two-module Reading and Listening, real timing, no help or transcripts.')
            : t('Listening con una sola escucha y 2 minutos de revisión, Reading de 60 minutos sin tiempo extra y Writing con las dos tareas en la misma hora.', 'Listening heard once with 2 minutes to check, 60-minute Reading with no extra time, and Writing with both tasks in one hour.')
        }
      />

      {inProgress.length > 0 && (
        <Card className="mb-6 border-warn/40 p-4">
          <SectionTitle>{t('Simulacros sin terminar', 'Unfinished mocks')}</SectionTitle>
          <ul className="space-y-2">
            {inProgress.map(([k, s]) => (
              <li key={k} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">
                  {t('Simulacro', 'Mock')} {s.mock} · {s.scope === 'full' ? t('completo', 'full') : s.scope}
                </span>
                <span className="text-muted">
                  {t('empezado', 'started')} {dateFmt(s.startedAt, t.lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {s.sections[s.sectionIdx]}
                </span>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => nav(`/exam/run/${s.exam}/${s.mock}/${s.scope}`)}>
                    <Play size={14} /> {t('Retomar', 'Resume')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => clearDraft(k)} aria-label={t('Descartar', 'Discard')}>
                    <Trash2 size={14} />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {(mocks.length ? mocks : [1, 2]).map((n) => (
          <Card key={n} className="overflow-hidden">
            <div className={cn('flex items-center justify-between px-5 py-4 text-white', isToefl ? 'bg-[#2433b0]' : 'bg-[#095c45]')}>
              <div>
                <div className="text-xs tracking-wide uppercase opacity-80">{isToefl ? 'TOEFL iBT · 2026' : 'IELTS Academic'}</div>
                <div className="font-display text-2xl font-bold">
                  {t('Simulacro', 'Practice Test')} {n}
                </div>
              </div>
              <Timer size={30} className="opacity-80" />
            </div>
            <div className="p-5">
              <p className="text-sm text-muted">
                {isToefl ? t('≈ 85–90 min · 4 secciones · notas 1–6, 0–120 comparable y MCER', '≈ 85–90 min · 4 sections · 1–6 scores, comparable 0–120 and CEFR') : t('≈ 2 h 45 min · 4 secciones · bandas 0–9', '≈ 2 h 45 min · 4 sections · bands 0–9')}
              </p>
              <Button size="lg" className="mt-4 w-full" onClick={() => go(n, 'full')}>
                <Play size={16} /> {t('Examen completo', 'Full test')}
              </Button>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {order.map(({ k, icon: I }) => (
                  <Button key={k} variant="outline" size="sm" onClick={() => go(n, k)} className="justify-center">
                    <I size={14} /> {k[0].toUpperCase() + k.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-5 p-5">
        <Switch
          id="flex"
          checked={flex}
          onCheckedChange={setFlex}
          label={
            <span>
              <span className="font-medium">{t('Modo flexible', 'Flexible mode')}</span>
              <span className="block text-xs text-muted">{t('Permite pausar el temporizador. Se indicará claramente en los resultados.', 'Lets you pause the timer. It will be clearly marked in the results.')}</span>
            </span>
          }
        />
      </Card>
      <Notice className="mt-4">
        {t(
          'Consejo: haz el simulacro con auriculares, en un sitio tranquilo y con Chrome o Edge (voces y reconocimiento de voz). Puedes cerrar la pestaña: tus respuestas se guardan y puedes retomarlo.',
          'Tip: use headphones, a quiet place and Chrome or Edge (voices and speech recognition). You can close the tab: answers are saved and you can resume.',
        )}
      </Notice>

      {past.length > 0 && (
        <div className="mt-8">
          <SectionTitle>{t('Resultados anteriores', 'Past results')}</SectionTitle>
          <div className="space-y-2">
            {past.map((a) => (
              <Link key={a.id} to={`/exam/report/${a.id}`}>
                <Card className="flex items-center gap-3 p-3.5 hover:border-accent">
                  <FileBarChart size={18} className="text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-faint">{dateFmt(a.finishedAt, t.lang)}</div>
                  </div>
                  {a.flexible && <Badge tone="warn">{t('flexible', 'flexible')}</Badge>}
                  <span className="font-display text-xl font-bold">{a.overall?.toFixed(1) ?? Object.values(a.bands ?? {})[0]?.toFixed(1) ?? '—'}</span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
      <p className="mt-6 flex items-center justify-center gap-1 text-center text-xs text-faint">
        <RotateCcw size={12} /> {t('Puedes repetir los simulacros, pero la segunda vez la nota será optimista.', 'You can retake mocks, but the second score will be optimistic.')}
      </p>
    </div>
  );
}
