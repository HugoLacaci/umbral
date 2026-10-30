import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Headphones, PenLine, Mic, Zap, ChevronRight, Flame } from 'lucide-react';
import { useApp, useUi } from '@/store';
import { useT } from '@/i18n';
import { BANK_META } from '@/content';
import { useBanks } from '@/content';
import { Card, PageHeader, ProgressBar, Badge } from '@/components/ui';
import type { BankKey } from '@/content/schema';

const hardCount = (sets: { difficulty?: string }[]) => sets.filter((s) => s.difficulty === 'hard').length;

const ICON = { reading: BookOpen, listening: Headphones, writing: PenLine, speaking: Mic };

export default function PracticeHome() {
  const t = useT();
  const nav = useNavigate();
  const exam = useUi((s) => s.exam);
  const attempts = useApp((s) => s.attempts);
  const metas = BANK_META.filter((b) => b.exam === exam);
  const banks = useBanks(metas.map((m) => m.key as BankKey));
  const order = exam === 'toefl' ? (['reading', 'listening', 'writing', 'speaking'] as const) : (['listening', 'reading', 'writing', 'speaking'] as const);

  return (
    <div>
      <PageHeader
        eyebrow={t('Práctica por destrezas', 'Skill practice')}
        title={t('Practica cada tipo de tarea', 'Practise every task type')}
        sub={t('Corrección inmediata con explicación de cada respuesta y la frase del texto que la justifica.', 'Instant feedback explaining every answer, with the sentence that proves it.')}
      />
      <Link to="/practice/drills" className="mb-6 block">
        <Card className="flex items-center gap-4 p-4 transition-colors hover:border-accent">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-xp/15 text-xp">
            <Zap size={22} />
          </span>
          <div className="flex-1">
            <div className="font-semibold">Grammar & Vocabulary drills</div>
            <div className="text-sm text-muted">{t('Sesiones rápidas de 5–10 min. Entrenamiento transversal: no es una sección del examen.', 'Quick 5–10 min sessions. Cross-skill training: not an exam section.')}</div>
          </div>
          <Badge tone="warn">{t('Entrenamiento', 'Training')}</Badge>
          <ChevronRight className="text-muted" size={18} />
        </Card>
      </Link>
      <div className="space-y-8">
        {order.map((section) => {
          const Icon = ICON[section];
          const list = metas.filter((m) => m.section === section);
          return (
            <section key={section}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Icon size={19} className="text-accent" /> {section[0].toUpperCase() + section.slice(1)}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((m, i) => {
                  const sets = (banks?.[m.key as BankKey] as { usage?: string; id: string; difficulty?: string }[] | undefined)?.filter((s) => s.usage !== 'mock') ?? [];
                  const done = new Set(attempts.filter((a) => a.bank === m.key).map((a) => a.setId)).size;
                  return (
                    <motion.div key={m.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <Link to={`/practice/${m.key}`} className="block h-full">
                        <Card className="flex h-full flex-col p-4 transition-all hover:-translate-y-0.5 hover:border-accent">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-sans text-[15px] font-semibold tracking-normal">{m.title}</h3>
                            <span className="shrink-0 font-mono text-xs text-faint">~{m.minutes} min</span>
                          </div>
                          <p className="mt-1 flex-1 text-[13.5px] text-muted">{t(m.es, m.en)}</p>
                          {hardCount(sets) > 0 && (
                            <span
                              role="link"
                              tabIndex={0}
                              onClick={(e) => {
                                e.preventDefault();
                                nav(`/practice/${m.key}?d=hard`);
                              }}
                              className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-bad-soft px-1.5 py-0.5 text-[11.5px] font-semibold text-bad hover:underline"
                            >
                              <Flame size={12} /> {hardCount(sets)} {t('difíciles', 'hard')}
                            </span>
                          )}
                          <div className="mt-3 flex items-center gap-3">
                            <ProgressBar value={done} max={sets.length || 1} />
                            <span className="shrink-0 font-mono text-xs text-muted">
                              {banks ? `${done}/${sets.length}` : '…'}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
