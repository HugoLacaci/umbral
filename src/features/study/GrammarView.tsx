import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, X, CheckCircle2, Lightbulb } from 'lucide-react';
import { useBank } from '@/content';
import type { DrillItem } from '@/content/schema';
import { useApp } from '@/store';
import { useT } from '@/i18n';
import { Button, Card, LoadingBlock, Badge, Notice, SectionTitle } from '@/components/ui';
import { Markdown } from '@/components/ui/Markdown';
import { drillMatch } from '@/features/practice/DrillSession';
import { cn } from '@/lib/cn';

export default function GrammarView() {
  const t = useT();
  const { id } = useParams();
  const { data } = useBank('study.grammar');
  const { studied, toggle } = useApp();
  if (!data) return <LoadingBlock />;
  const g = data.find((x) => x.id === id);
  if (!g) return <Notice tone="bad">404</Notice>;
  const done = studied.includes(`grammar:${g.id}`);
  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/study/grammar" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {t('Gramática', 'Grammar')}
      </Link>
      <div className="mb-2 flex gap-2">
        <Badge tone="accent">{g.level}</Badge>
        <Badge>{g.title}</Badge>
      </div>
      <h1 className="text-[30px] leading-tight font-bold">{t.lang === 'es' ? g.titleEs : g.title}</h1>
      <Notice tone="accent" icon={<Lightbulb size={16} />} className="mt-4">
        <strong>{t('Por qué sube nota', 'Why it raises your score')}:</strong> {g.why}
      </Notice>
      <div className="mt-6">
        <Markdown source={g.explanation} />
      </div>
      <Card className="mt-6 p-5">
        <SectionTitle>{t('Ejemplos', 'Examples')}</SectionTitle>
        <ul className="space-y-2">
          {g.examples.map((e, i) => (
            <li key={i}>
              <p className="font-serif text-[15.5px] italic">{e.en}</p>
              {e.note && <p className="text-[13px] text-muted">{e.note}</p>}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="mt-4 p-5">
        <SectionTitle>{t('Errores típicos de hispanohablantes', 'Typical Spanish-speaker mistakes')}</SectionTitle>
        <ul className="space-y-3">
          {g.mistakes.map((m, i) => (
            <li key={i} className="text-[14px]">
              <div className="flex items-start gap-2 text-bad">
                <X size={15} className="mt-0.5 shrink-0" /> <span className="line-through">{m.wrong}</span>
              </div>
              <div className="flex items-start gap-2 text-good">
                <Check size={15} className="mt-0.5 shrink-0" /> <span className="font-medium">{m.right}</span>
              </div>
              <p className="ml-6 text-[13px] text-muted">{m.why}</p>
            </li>
          ))}
        </ul>
      </Card>
      <h2 className="mt-8 mb-3 text-xl font-bold">{t('Ejercicios', 'Exercises')}</h2>
      <div className="space-y-3">
        {g.exercises.map((ex, i) => (
          <Exercise key={ex.id} ex={ex} n={i + 1} />
        ))}
      </div>
      <div className="mt-8 border-t border-line pt-5">
        <Button variant={done ? 'good' : 'primary'} onClick={() => toggle('studied', `grammar:${g.id}`)}>
          <CheckCircle2 size={16} /> {done ? t('Tema estudiado', 'Topic studied') : t('Marcar como estudiado', 'Mark as studied')}
        </Button>
      </div>
    </article>
  );
}

function Exercise({ ex, n }: { ex: DrillItem; n: number }) {
  const t = useT();
  const [val, setVal] = useState('');
  const [res, setRes] = useState<boolean | null>(null);
  const check = (v: string) => setRes(drillMatch(v, ex.answers));
  return (
    <Card className="p-4">
      <p className="text-[15px] whitespace-pre-line">
        <span className="mr-1.5 font-semibold text-accent">{n}.</span>
        {ex.prompt}
      </p>
      {ex.type === 'mcq' && ex.options ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {ex.options.map((o) => (
            <button
              key={o}
              disabled={res !== null}
              onClick={() => {
                setVal(o);
                check(o);
              }}
              className={cn('rounded-lg border px-3 py-1.5 text-sm', res !== null && ex.answers.includes(o) ? 'border-good bg-good-soft' : res === false && val === o ? 'border-bad bg-bad-soft' : 'border-line-strong hover:border-accent')}
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            check(val);
          }}
        >
          <input value={val} onChange={(e) => setVal(e.target.value)} disabled={res !== null} spellCheck={false} className="h-10 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-sm outline-none focus:border-accent" aria-label={`${t('Respuesta', 'Answer')} ${n}`} />
          {res === null && (
            <Button type="submit" size="md" variant="outline" disabled={!val.trim()}>
              {t('Comprobar', 'Check')}
            </Button>
          )}
        </form>
      )}
      {res !== null && (
        <div className={cn('mt-3 rounded-xl p-3 text-[13.5px]', res ? 'bg-good-soft' : 'bg-bad-soft')}>
          <span className={cn('font-semibold', res ? 'text-good' : 'text-bad')}>{res ? t('Correcto', 'Correct') : `${t('Respuesta', 'Answer')}: ${ex.answers[0]}`}</span>
          <p className="mt-1 text-muted">{ex.explanation}</p>
          {!res && (
            <button
              className="mt-1 text-xs font-medium text-accent"
              onClick={() => {
                setRes(null);
                setVal('');
              }}
            >
              {t('Reintentar', 'Retry')}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
