import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Zap, RotateCcw, ArrowRight } from 'lucide-react';
import { useBank } from '@/content';
import type { DrillItem } from '@/content/schema';
import { useApp, useUi } from '@/store';
import { useT } from '@/i18n';
import { Button, Card, PageHeader, LoadingBlock, ProgressBar, Segmented, Badge, Notice } from '@/components/ui';
import { cn, seededShuffle } from '@/lib/cn';

/** Comparación tolerante para drills (mayúsculas, espacios, puntuación final, comillas). */
export function drillMatch(answer: string, accepted: string[]): boolean {
  const n = (s: string) =>
    s
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[“”]/g, '"')
      .trim()
      .replace(/[.!?;,]+$/g, '')
      // las comas internas no se penalizan ("If I had a car I could…")
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const a = n(answer);
  if (!a) return false;
  return accepted.some((x) => n(x) === a);
}

const TYPE_LABEL: Record<DrillItem['type'], { es: string; en: string }> = {
  gap: { es: 'Completa el hueco', en: 'Fill the gap' },
  transform: { es: 'Transforma la frase', en: 'Transform the sentence' },
  error: { es: 'Corrige el error (escribe la frase o la parte corregida)', en: 'Correct the error (type the sentence or the corrected part)' },
  collocation: { es: 'Colocación', en: 'Collocation' },
  mcq: { es: 'Elige la opción correcta', en: 'Choose the correct option' },
};

export default function DrillSession() {
  const t = useT();
  const exam = useUi((s) => s.exam);
  const { data } = useBank('study.drills');
  const saveAttempt = useApp((s) => s.saveAttempt);
  const [size, setSize] = useState<'5' | '10' | '20'>('10');
  const [tag, setTag] = useState('all');
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [i, setI] = useState(0);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<boolean[]>([]);
  const [shown, setShown] = useState(false);
  const started = useRef(Date.now());

  const tags = useMemo(() => [...new Set((data ?? []).flatMap((d) => d.tags))].sort(), [data]);
  const queue = useMemo(() => seededShuffle((data ?? []).filter((d) => tag === 'all' || d.tags.includes(tag)), seed).slice(0, +size), [data, seed, size, tag]);
  const cur = queue[i];
  const finished = data && results.length === queue.length && queue.length > 0 && !shown;

  const restart = () => {
    setSeed(String(Date.now()));
    setI(0);
    setResults([]);
    setInput('');
    setShown(false);
    started.current = Date.now();
  };

  const submit = (value: string) => {
    if (!cur || shown) return;
    const ok = drillMatch(value, cur.answers);
    setResults((r) => [...r, ok]);
    setShown(true);
    if (results.length + 1 === queue.length) {
      const all = [...results, ok];
      saveAttempt({
        exam,
        kind: 'practice',
        bank: 'study.drills',
        setId: `drills-${seed}`,
        title: 'Grammar & Vocabulary drill',
        sections: [],
        startedAt: started.current,
        finishedAt: Date.now(),
        durationSec: Math.round((Date.now() - started.current) / 1000),
        items: queue.map((q, k) => ({ qid: q.id, qtype: `drill:${q.tags[0] ?? q.type}`, section: 'writing', earned: all[k] ? 1 : 0, max: 1, correct: all[k] })),
      });
    }
  };
  const nextQ = () => {
    setI((x) => x + 1);
    setInput('');
    setShown(false);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/practice" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {t('Práctica', 'Practice')}
      </Link>
      <PageHeader eyebrow={t('Entrenamiento transversal', 'Cross-skill training')} title="Grammar & Vocabulary drills" sub={t('No es una sección del TOEFL ni del IELTS, pero es la base de todo.', 'Not a TOEFL or IELTS section, but the foundation of everything.')} />
      {!data ? (
        <LoadingBlock />
      ) : finished ? (
        <Card className="p-8 text-center">
          <Zap className="mx-auto text-xp" size={36} />
          <div className="mt-3 font-display text-4xl font-bold">
            {results.filter(Boolean).length}/{queue.length}
          </div>
          <p className="mt-1 text-muted">{t('¡Sesión completada!', 'Session complete!')}</p>
          <Button className="mt-5" onClick={restart}>
            <RotateCcw size={15} /> {t('Otra sesión', 'Another session')}
          </Button>
        </Card>
      ) : (
        <>
          {i === 0 && results.length === 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Segmented value={size} onChange={(v) => { setSize(v); restart(); }} options={[{ value: '5', label: '5' }, { value: '10', label: '10' }, { value: '20', label: '20' }]} />
              <select value={tag} onChange={(e) => { setTag(e.target.value); restart(); }} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm" aria-label={t('Tema', 'Topic')}>
                <option value="all">{t('Todos los temas', 'All topics')}</option>
                {tags.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mb-3 flex items-center gap-3">
            <ProgressBar value={results.length} max={queue.length} />
            <span className="font-mono text-xs text-muted">
              {results.length}/{queue.length}
            </span>
          </div>
          {cur && (
            <Card className="p-6">
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge tone="accent">{t.x(TYPE_LABEL[cur.type])}</Badge>
                <Badge>{cur.level}</Badge>
                {cur.tags.map((x) => (
                  <Badge key={x}>{x}</Badge>
                ))}
              </div>
              <p className="text-[17px] leading-relaxed font-medium whitespace-pre-line">{cur.prompt}</p>
              {cur.type === 'mcq' && cur.options ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {cur.options.map((o) => {
                    const right = shown && cur.answers.includes(o);
                    const wrong = shown && input === o && !right;
                    return (
                      <button
                        key={o}
                        disabled={shown}
                        onClick={() => {
                          setInput(o);
                          submit(o);
                        }}
                        className={cn('min-h-11 rounded-xl border px-3 py-2 text-left text-[15px]', right ? 'border-good bg-good-soft' : wrong ? 'border-bad bg-bad-soft' : 'border-line-strong bg-surface hover:border-accent')}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(input);
                  }}
                >
                  <input
                    autoFocus
                    value={input}
                    disabled={shown}
                    onChange={(e) => setInput(e.target.value)}
                    spellCheck={false}
                    autoCapitalize="off"
                    className="h-11 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-[15px] outline-none focus:border-accent"
                    aria-label={t('Tu respuesta', 'Your answer')}
                  />
                  {!shown && (
                    <Button type="submit" disabled={!input.trim()}>
                      <Check size={16} />
                    </Button>
                  )}
                </form>
              )}
              {shown && (
                <div className={cn('mt-4 rounded-xl border p-3 text-[14px]', results.at(-1) ? 'border-good/30 bg-good-soft' : 'border-bad/30 bg-bad-soft')}>
                  <div className={cn('flex items-center gap-1.5 font-semibold', results.at(-1) ? 'text-good' : 'text-bad')}>
                    {results.at(-1) ? <Check size={15} /> : <X size={15} />} {results.at(-1) ? t('Correcto', 'Correct') : t('Respuesta', 'Answer')}: {cur.answers[0]}
                  </div>
                  <p className="mt-1 text-muted">{cur.explanation}</p>
                  {!results.at(-1) && cur.answers.length > 1 && <p className="mt-1 text-xs text-faint">{t('También válido', 'Also accepted')}: {cur.answers.slice(1).join(' · ')}</p>}
                </div>
              )}
              {shown && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={nextQ} autoFocus>
                    {i + 1 < queue.length ? t('Siguiente', 'Next') : t('Ver resultado', 'See result')} <ArrowRight size={15} />
                  </Button>
                </div>
              )}
            </Card>
          )}
          {queue.length === 0 && <Notice>{t('No hay drills con ese filtro.', 'No drills match that filter.')}</Notice>}
        </>
      )}
    </div>
  );
}
