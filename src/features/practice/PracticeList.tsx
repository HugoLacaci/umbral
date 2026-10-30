import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, BookOpen, ChevronRight } from 'lucide-react';
import { useBank, bankMeta } from '@/content';
import type { BankKey } from '@/content/schema';
import { useApp } from '@/store';
import { useT } from '@/i18n';
import { Card, PageHeader, DifficultyBadge, Segmented, LoadingBlock, Badge, EmptyState } from '@/components/ui';
import { pct } from '@/lib/cn';

type AnySet = { prompt?: string; id: string; difficulty: 'easy' | 'medium' | 'hard'; usage: string; title?: string; topic?: string; part?: number; passageNo?: number; chartType?: string; essayType?: string; cue?: string; course?: string; scenario?: string; context?: unknown };

export function setLabel(s: AnySet): string {
  if (s.title) return s.title;
  // Primera frase del enunciado (Writing): "The maps below show Elmfield Park in 2005…"
  if (s.prompt) return s.prompt.split(/(?<=\.)\s/)[0].slice(0, 110);
  if (s.topic && s.cue) return s.cue;
  if (s.topic) return s.topic;
  if (s.course) return s.course;
  if (s.scenario) return s.scenario.slice(0, 80) + '…';
  if (s.essayType) return s.essayType;
  if (s.context && typeof s.context === 'object' && 'text' in (s.context as object)) return (s.context as { text: string }).text;
  if (typeof s.context === 'string') return s.context.slice(0, 80);
  return s.id;
}

export default function PracticeList() {
  const t = useT();
  const { bank } = useParams();
  const meta = bankMeta(bank ?? '');
  const { data } = useBank((meta?.key as BankKey) ?? null);
  const attempts = useApp((s) => s.attempts);
  const [search] = useSearchParams();
  const [diff, setDiff] = useState<'all' | 'easy' | 'medium' | 'hard'>(search.get('d') === 'hard' ? 'hard' : 'all');
  const [sub, setSub] = useState<string>('all');
  if (!meta) return <EmptyState icon={<BookOpen />} title="404" />;

  const sets = ((data ?? []) as unknown as AnySet[]).filter((s) => s.usage !== 'mock');
  const subKey = (s: AnySet) => (s.part ? `Part ${s.part}` : s.passageNo ? `Passage ${s.passageNo}` : s.chartType ?? s.essayType ?? '');
  const subs = [...new Set(sets.map(subKey).filter(Boolean))].sort();
  const shown = sets.filter((s) => (diff === 'all' || s.difficulty === diff) && (sub === 'all' || subKey(s) === sub));
  const best = (id: string) => {
    const a = attempts.filter((x) => x.bank === meta.key && x.setId === id);
    if (!a.length) return null;
    const scores = a.map((x) => {
      const e = x.items.reduce((s, i) => s + i.earned, 0);
      const m = x.items.reduce((s, i) => s + i.max, 0);
      return m ? pct(e, m) : null;
    });
    return { n: a.length, best: Math.max(...scores.map((s) => s ?? -1)) };
  };

  return (
    <div>
      <Link to="/practice" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {t('Práctica', 'Practice')}
      </Link>
      <PageHeader
        eyebrow={meta.section}
        title={meta.title}
        sub={t(meta.es, meta.en)}
        actions={
          meta.lesson && (
            <Link to={`/study/lesson/${meta.lesson}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2">
              <BookOpen size={16} /> {t('Guía de la tarea', 'Task guide')}
            </Link>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={diff}
          onChange={setDiff}
          options={[
            { value: 'all', label: t('Todas', 'All') },
            { value: 'easy', label: t('Fácil', 'Easy') },
            { value: 'medium', label: t('Media', 'Medium') },
            { value: 'hard', label: t('Difícil', 'Hard') },
          ]}
        />
        {subs.length > 1 && (
          <select value={sub} onChange={(e) => setSub(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm" aria-label={t('Filtrar por tipo', 'Filter by type')}>
            <option value="all">{t('Todos los tipos', 'All types')}</option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <span className="text-sm text-muted">
          {shown.length} {t('ejercicios', 'exercises')}
        </span>
      </div>
      {!data ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {shown.map((s, i) => {
            const b = best(s.id);
            return (
              <Link key={s.id} to={`/practice/${meta.key}/${s.id}`}>
                <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-accent">
                  <span className="w-7 shrink-0 text-center font-mono text-sm text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-medium">{setLabel(s)}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <DifficultyBadge d={s.difficulty} lang={t.lang} />
                      {subKey(s) && <Badge>{subKey(s)}</Badge>}
                    </div>
                  </div>
                  {b && (
                    <span className="flex items-center gap-1 text-[12.5px] font-medium text-good">
                      <CheckCircle2 size={15} /> {b.best >= 0 ? `${b.best} %` : '✓'}
                    </span>
                  )}
                  <ChevronRight size={16} className="text-faint" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
