import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { History as HistoryIcon, Trash2, FileBarChart, ChevronRight } from 'lucide-react';
import { useApp, useUi, qtypeStats } from '@/store';
import { useT, dateFmt } from '@/i18n';
import { Card, PageHeader, SectionTitle, Badge, EmptyState, ProgressBar, Segmented, ConfirmDialog } from '@/components/ui';
import { QTYPES } from '@/content/schema';
import { bankMeta } from '@/content';
import { fmtTime, pct } from '@/lib/cn';

export default function HistoryPage() {
  const t = useT();
  const exam = useUi((s) => s.exam);
  const { attempts, deleteAttempt } = useApp();
  const [filter, setFilter] = useState<'all' | 'mock' | 'practice'>('all');
  const [del, setDel] = useState<string | null>(null);
  const list = useMemo(() => attempts.filter((a) => a.exam === exam && (filter === 'all' || a.kind === filter)).sort((a, b) => b.finishedAt - a.finishedAt), [attempts, exam, filter]);
  const stats = useMemo(() => qtypeStats(attempts, exam).sort((a, b) => a.rate - b.rate), [attempts, exam]);

  return (
    <div>
      <PageHeader eyebrow={t('Historial', 'History')} title={t('Tu progreso', 'Your progress')} sub={t('Todos tus intentos, con acierto por tipo de pregunta.', 'All your attempts, with accuracy by question type.')} />
      {stats.length > 0 && (
        <Card className="mb-6 p-5">
          <SectionTitle sub={t('Ordenado de peor a mejor.', 'Sorted worst first.')}>{t('Acierto por tipo de pregunta', 'Accuracy by question type')}</SectionTitle>
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
            {stats.map((s) => (
              <div key={s.qtype} className="grid grid-cols-[1fr_100px_70px] items-center gap-3 text-[13px]">
                {QTYPES[s.qtype]?.lesson ? (
                  <Link to={`/study/lesson/${QTYPES[s.qtype].lesson}`} className="truncate hover:text-accent">
                    {t.x(QTYPES[s.qtype])}
                  </Link>
                ) : (
                  <span className="truncate">{QTYPES[s.qtype] ? t.x(QTYPES[s.qtype]) : s.qtype}</span>
                )}
                <ProgressBar value={s.correct} max={s.seen} tone={s.rate >= 0.75 ? 'good' : s.rate >= 0.5 ? 'warn' : 'bad'} />
                <span className="text-right font-mono">{Math.round(s.rate * 100)} %</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="mb-3 flex items-center justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('Todo', 'All') },
            { value: 'mock', label: t('Simulacros', 'Mocks') },
            { value: 'practice', label: t('Práctica', 'Practice') },
          ]}
        />
        <span className="text-sm text-muted">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<HistoryIcon size={24} />} title={t('Todavía no hay intentos', 'No attempts yet')}>
          {t('Cuando practiques o hagas un simulacro, aparecerá aquí.', 'Your practice and mocks will appear here.')}
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {list.map((a) => {
            const e = a.items.reduce((s, i) => s + i.earned, 0);
            const m = a.items.reduce((s, i) => s + i.max, 0);
            const objective = a.items.every((i) => i.max === 1);
            const link = a.kind === 'mock' ? `/exam/report/${a.id}` : a.bank && a.setId && bankMeta(a.bank) ? `/practice/${a.bank}/${a.setId}` : null;
            const inner = (
              <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-accent">
                {a.kind === 'mock' ? <FileBarChart size={18} className="shrink-0 text-accent" /> : <HistoryIcon size={18} className="shrink-0 text-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{a.title}</div>
                  <div className="text-xs text-faint">
                    {dateFmt(a.finishedAt, t.lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {fmtTime(a.durationSec)} {a.bank ? `· ${bankMeta(a.bank)?.title ?? a.bank}` : ''}
                  </div>
                </div>
                {a.flexible && <Badge tone="warn">flex</Badge>}
                {objective && m > 0 && (
                  <Badge tone={pct(e, m) >= 70 ? 'good' : pct(e, m) >= 50 ? 'warn' : 'bad'}>
                    {e}/{m}
                  </Badge>
                )}
                {(a.overall ?? Object.values(a.bands ?? {})[0]) !== undefined && <span className="font-display text-lg font-bold">{(a.overall ?? Object.values(a.bands ?? {})[0])!.toFixed(1)}</span>}
                <button
                  onClick={(ev) => {
                    ev.preventDefault();
                    setDel(a.id);
                  }}
                  className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-bad"
                  aria-label={t('Borrar intento', 'Delete attempt')}
                >
                  <Trash2 size={15} />
                </button>
                {link && <ChevronRight size={15} className="text-faint" />}
              </Card>
            );
            return link ? (
              <Link key={a.id} to={link}>
                {inner}
              </Link>
            ) : (
              <div key={a.id}>{inner}</div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={t('¿Borrar este intento?', 'Delete this attempt?')} confirm={t('Borrar', 'Delete')} cancel={t('Cancelar', 'Cancel')} danger onConfirm={() => del && deleteAttempt(del)} />
    </div>
  );
}
