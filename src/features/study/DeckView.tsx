import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Volume2, RotateCcw, Layers, List, ClipboardCheck, AlertTriangle, Check, X, PartyPopper } from 'lucide-react';
import { useBank } from '@/content';
import type { Card as CardT, Deck } from '@/content/schema';
import { useApp } from '@/store';
import { useT } from '@/i18n';
import { Button, Card, LoadingBlock, Segmented, Badge, Kbd, ProgressBar, EmptyState } from '@/components/ui';
import { isDue, mastery, previewInterval, newCard, type Grade } from '@/engine/srs';
import { say } from '@/engine/tts';
import { cn, seededShuffle } from '@/lib/cn';

const NEW_PER_SESSION = 15;

export default function DeckView() {
  const t = useT();
  const { id } = useParams();
  const { data } = useBank('study.decks');
  const [mode, setMode] = useState<'study' | 'list' | 'test'>('study');
  if (!data) return <LoadingBlock />;
  // Mazo virtual con todas las tarjetas pendientes
  const deck: Deck | undefined =
    id === '__due'
      ? { id: '__due', category: 'awl', title: 'Due today', titleEs: 'Repaso de hoy', description: '', cards: data.flatMap((d) => d.cards) }
      : data.find((d) => d.id === id);
  if (!deck) return <EmptyState icon={<Layers />} title="404" />;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/study/vocab" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {t('Vocabulario', 'Vocabulary')}
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold">{t.lang === 'es' ? deck.titleEs : deck.title}</h1>
          {deck.description && <p className="mt-1 text-sm text-muted">{deck.description}</p>}
        </div>
        {id !== '__due' && (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'study', label: <span className="flex items-center gap-1.5"><Layers size={14} /> Flashcards</span> },
              { value: 'list', label: <span className="flex items-center gap-1.5"><List size={14} /> {t('Lista', 'List')}</span> },
              { value: 'test', label: <span className="flex items-center gap-1.5"><ClipboardCheck size={14} /> Test</span> },
            ]}
          />
        )}
      </div>
      {mode === 'study' && <Flashcards deck={deck} dueOnly={id === '__due'} />}
      {mode === 'list' && <CardList deck={deck} />}
      {mode === 'test' && <DeckTest deck={deck} />}
    </div>
  );
}

function speak(c: CardT) {
  say(`${c.term}. ${c.example}`, 'en-GB', 0.95);
}

function Flashcards({ deck, dueOnly }: { deck: Deck; dueOnly: boolean }) {
  const t = useT();
  const srs = useApp((s) => s.srs);
  const reviewCard = useApp((s) => s.reviewCard);
  // La cola se fija al empezar la sesión: pendientes + hasta 15 nuevas
  const [queue, setQueue] = useState<string[]>(() => {
    const now = Date.now();
    const due = deck.cards.filter((c) => srs[c.id] && isDue(srs[c.id], now)).map((c) => c.id);
    const fresh = dueOnly ? [] : deck.cards.filter((c) => !srs[c.id]).slice(0, NEW_PER_SESSION).map((c) => c.id);
    return [...due, ...fresh];
  });
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const byId = useMemo(() => new Map(deck.cards.map((c) => [c.id, c])), [deck]);
  const card = byId.get(queue[0]);

  const grade = (g: Grade) => {
    if (!card) return;
    reviewCard(card.id, g);
    setFlipped(false);
    setDone((d) => d + 1);
    // "Otra vez" vuelve a la cola dentro de la sesión
    setQueue((q) => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) grade((['again', 'hard', 'good', 'easy'] as Grade[])[+e.key - 1]);
      else if (e.key.toLowerCase() === 'p' && card) speak(card);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!card)
    return (
      <EmptyState icon={<PartyPopper size={24} />} title={done ? t('¡Sesión terminada!', 'Session complete!') : t('Nada que repasar ahora', 'Nothing to review now')}>
        {done
          ? t(`Has repasado ${done} tarjetas. Vuelve mañana para los repasos programados.`, `You reviewed ${done} cards. Come back tomorrow for scheduled reviews.`)
          : t('Ya has visto todas las tarjetas nuevas de este mazo y no hay repasos pendientes.', 'All new cards seen and no reviews due.')}
      </EmptyState>
    );

  const st = srs[card.id] ?? newCard();
  const m = mastery(srs[card.id]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-xs text-muted">
        <ProgressBar value={done} max={done + queue.length} />
        <span className="shrink-0 font-mono">
          {queue.length} {t('restantes', 'left')}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={card.id + String(flipped)} initial={{ opacity: 0, rotateX: -8 }} animate={{ opacity: 1, rotateX: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <Card
            role="button"
            tabIndex={0}
            aria-label={flipped ? t('Ocultar respuesta', 'Hide answer') : t('Mostrar respuesta', 'Show answer')}
            onClick={() => setFlipped((f) => !f)}
            className="flex min-h-[320px] cursor-pointer flex-col items-center justify-center p-6 text-center select-none sm:p-10"
          >
            <Badge tone={m === 'new' ? 'accent' : 'neutral'} className="mb-4">
              {m === 'new' ? t('Nueva', 'New') : m === 'learning' ? t('Aprendiendo', 'Learning') : t('Repaso', 'Review')}
            </Badge>
            <div className="font-display text-[34px] leading-tight font-bold sm:text-[42px]">{card.term}</div>
            {card.pos && <div className="mt-1 text-sm text-faint italic">{card.pos}</div>}
            {!flipped ? (
              <p className="mt-6 text-sm text-faint">
                {t('Toca o pulsa', 'Tap or press')} <Kbd>Espacio</Kbd> {t('para ver el significado', 'to reveal')}
              </p>
            ) : (
              <div className="mt-5 max-w-xl space-y-2.5 text-[15px]">
                <p className="font-medium">{card.definition}</p>
                {card.es && <p className="text-accent">🇪🇸 {card.es}</p>}
                <p className="font-serif text-[16px] text-muted italic">“{card.example}”</p>
                {card.collocations && card.collocations.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {card.collocations.map((c) => (
                      <Badge key={c}>{c}</Badge>
                    ))}
                  </div>
                )}
                {card.family && card.family.length > 0 && <p className="text-[12.5px] text-faint">{t('Familia', 'Family')}: {card.family.join(' · ')}</p>}
                {card.warning && (
                  <p className="flex items-start justify-center gap-1 text-[13px] text-warn">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {card.warning}
                  </p>
                )}
                {card.note && <p className="text-[12.5px] text-muted">{card.note}</p>}
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
      <div className="mt-3 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => speak(card)}>
          <Volume2 size={15} /> {t('Escuchar', 'Listen')} <Kbd>P</Kbd>
        </Button>
      </div>
      {flipped && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {(
            [
              ['again', t('Otra vez', 'Again'), 'border-bad/40 text-bad hover:bg-bad-soft'],
              ['hard', t('Difícil', 'Hard'), 'border-warn/40 text-warn hover:bg-warn-soft'],
              ['good', t('Bien', 'Good'), 'border-good/40 text-good hover:bg-good-soft'],
              ['easy', t('Fácil', 'Easy'), 'border-accent/40 text-accent hover:bg-accent-soft'],
            ] as const
          ).map(([g, label, cls], k) => (
            <button key={g} onClick={() => grade(g)} className={cn('flex flex-col items-center rounded-xl border bg-surface py-2.5 text-sm font-semibold', cls)}>
              {label}
              <span className="mt-0.5 font-mono text-[11px] font-normal opacity-75">
                {previewInterval(st, g)} · {k + 1}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardList({ deck }: { deck: Deck }) {
  const t = useT();
  const srs = useApp((s) => s.srs);
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {deck.cards.map((c) => {
        const m = mastery(srs[c.id]);
        return (
          <div key={c.id} className="flex gap-3 p-3.5">
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', m === 'new' ? 'bg-line-strong' : m === 'mature' ? 'bg-good' : 'bg-warn')} title={m} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{c.term}</span>
                {c.pos && <span className="text-xs text-faint italic">{c.pos}</span>}
                {c.es && <span className="text-sm text-accent">{c.es}</span>}
                {c.register && c.register !== 'neutral' && <Badge>{c.register}</Badge>}
              </div>
              <p className="text-[13.5px] text-muted">{c.definition}</p>
              <p className="mt-0.5 font-serif text-[13.5px] italic">“{c.example}”</p>
              {c.warning && <p className="mt-0.5 text-[12.5px] text-warn">⚠ {c.warning}</p>}
            </div>
            <button onClick={() => speak(c)} className="h-8 w-8 shrink-0 rounded-lg text-muted hover:bg-surface-2" aria-label={`${t('Escuchar', 'Listen')} ${c.term}`}>
              <Volume2 size={15} className="mx-auto" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Modo test: definición → elige la palabra (4 opciones del mismo mazo). */
function DeckTest({ deck }: { deck: Deck }) {
  const t = useT();
  const [seed, setSeed] = useState(String(Date.now()));
  const qs = useMemo(() => seededShuffle(deck.cards, seed).slice(0, Math.min(10, deck.cards.length)), [deck, seed]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const reviewCard = useApp((s) => s.reviewCard);
  const q = qs[i];
  const options = useMemo(() => (q ? seededShuffle([q, ...seededShuffle(deck.cards.filter((c) => c.id !== q.id), seed + i).slice(0, 3)], q.id + seed) : []), [q, deck, seed, i]);
  if (deck.cards.length < 4) return <p className="text-sm text-muted">{t('Mazo demasiado pequeño para el test.', 'Deck too small for a test.')}</p>;
  if (!q)
    return (
      <Card className="p-8 text-center">
        <div className="font-display text-4xl font-bold">
          {score}/{qs.length}
        </div>
        <Button
          className="mt-4"
          onClick={() => {
            setSeed(String(Date.now()));
            setI(0);
            setScore(0);
            setPicked(null);
          }}
        >
          <RotateCcw size={15} /> {t('Otro test', 'Another test')}
        </Button>
      </Card>
    );
  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>
          {i + 1}/{qs.length}
        </span>
        <span>
          {t('Aciertos', 'Score')}: {score}
        </span>
      </div>
      <p className="text-[17px] font-medium">{q.definition}</p>
      {q.es && <p className="mt-1 text-sm text-faint">({q.es})</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const right = picked && o.id === q.id;
          const wrong = picked === o.id && o.id !== q.id;
          return (
            <button
              key={o.id}
              disabled={!!picked}
              onClick={() => {
                setPicked(o.id);
                const ok = o.id === q.id;
                if (ok) setScore((s) => s + 1);
                reviewCard(q.id, ok ? 'good' : 'again');
              }}
              className={cn('flex h-12 items-center justify-between rounded-xl border px-4 text-left font-semibold', right ? 'border-good bg-good-soft' : wrong ? 'border-bad bg-bad-soft' : 'border-line-strong bg-surface hover:border-accent')}
            >
              {o.term}
              {right && <Check size={16} className="text-good" />}
              {wrong && <X size={16} className="text-bad" />}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="font-serif text-sm text-muted italic">“{q.example}”</p>
          <Button
            onClick={() => {
              setI(i + 1);
              setPicked(null);
            }}
          >
            {t('Siguiente', 'Next')}
          </Button>
        </div>
      )}
    </Card>
  );
}
