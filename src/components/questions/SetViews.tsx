import { useMemo, useState, type ReactNode } from 'react';
import { StickyNote, Highlighter, Shuffle, Undo2 } from 'lucide-react';
import type { Group, IeltsReadingPassage, ToeflBuildItem, ToeflCtwSet, ToeflReadingSet, Audio, McqItem } from '@/content/schema';
import { parseCtw, checkCtwBlank } from '@/engine/ctw';
import { GroupView, McqView, Feedback, numberItems, type Answers } from './Items';
import { Highlightable, type Range } from './Highlightable';
import { useT } from '@/i18n';
import { cn, seededShuffle } from '@/lib/cn';
import type { Response } from '@/engine/grading';

/* ─────────── Layout de pantalla partida (texto | preguntas) ─────────── */

export function SplitPane({ left, right, className }: { left: ReactNode; right: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-4 lg:grid-cols-2 lg:gap-0', className)}>
      <div className="scroll-thin min-w-0 lg:max-h-[calc(100dvh-180px)] lg:overflow-y-auto lg:border-r lg:border-line lg:pr-6">{left}</div>
      <div className="scroll-thin min-w-0 lg:max-h-[calc(100dvh-180px)] lg:overflow-y-auto lg:pl-6">{right}</div>
    </div>
  );
}

/** Convierte las preguntas MCQ de un set TOEFL en un grupo genérico. */
export function toeflGroup(questions: McqItem[], id = 'g'): Group {
  return { id, qtype: questions[0]?.qtype ?? 'mcq', instructions: '', items: questions };
}

/* ─────────── Texto con resaltador + notas ─────────── */

export function PassagePanel({
  title,
  subtitle,
  paragraphs,
  evidence,
  format,
}: {
  title: string;
  subtitle?: string;
  paragraphs: { label?: string; text: string }[];
  evidence?: string[];
  format?: string;
}) {
  const t = useT();
  const [hl, setHl] = useState<Record<number, Range[]>>({});
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const isDoc = !!format;
  return (
    <article>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted italic">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <span className="hidden items-center gap-1 text-[11px] text-faint sm:flex" title={t('Selecciona texto para resaltarlo; pulsa un resaltado para quitarlo.', 'Select text to highlight; click a highlight to remove it.')}>
            <Highlighter size={13} /> {t('Selecciona para resaltar', 'Select to highlight')}
          </span>
          <button onClick={() => setShowNotes((s) => !s)} className={cn('rounded-lg p-1.5', showNotes ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2')} aria-label={t('Notas', 'Notes')} aria-pressed={showNotes}>
            <StickyNote size={16} />
          </button>
        </div>
      </div>
      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('Tus notas (no se corrigen)…', 'Your notes (not marked)…')}
          className="mb-3 h-24 w-full rounded-xl border border-warn/40 bg-warn-soft p-2.5 text-sm outline-none"
        />
      )}
      <div className={cn('passage', isDoc && 'rounded-2xl border border-line bg-surface p-4 font-sans text-[15px]')}>
        {paragraphs.map((p, i) => (
          <div key={i} className={cn('flex gap-3', i > 0 && 'mt-4')}>
            {p.label && <span className="w-5 shrink-0 pt-0.5 font-sans text-sm font-bold text-accent">{p.label}</span>}
            <Highlightable
              text={p.text}
              highlights={hl[i] ?? []}
              evidence={evidence}
              onHighlight={(r) => setHl((h) => ({ ...h, [i]: [...(h[i] ?? []), r] }))}
              onRemove={(k) => setHl((h) => ({ ...h, [i]: (h[i] ?? []).filter((_, j) => j !== k) }))}
              className="flex-1"
            />
          </div>
        ))}
      </div>
    </article>
  );
}

/* ─────────── TOEFL Reading (Daily Life / Academic Passage) ─────────── */

export function ToeflReadingView({ set, answers, setAnswer, reveal }: { set: ToeflReadingSet; answers: Answers; setAnswer: (id: string, v: Response) => void; reveal?: boolean }) {
  const paragraphs = set.text.split(/\n\s*\n/).map((text) => ({ text }));
  const evidence = reveal ? set.questions.map((q) => q.evidence ?? '').filter(Boolean) : [];
  return (
    <SplitPane
      left={<PassagePanel title={set.title} paragraphs={paragraphs} evidence={evidence} format={set.task === 'daily-life' ? set.format ?? 'doc' : undefined} />}
      right={
        <div className="space-y-6">
          {set.questions.map((q, i) => (
            <div key={q.id}>
              <McqView item={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} reveal={reveal} number={`${i + 1}.`} />
              {reveal && <Feedback item={q} value={answers[q.id]} />}
            </div>
          ))}
        </div>
      }
    />
  );
}

/* ─────────── IELTS Reading ─────────── */

export function IeltsReadingView({
  passage,
  answers,
  setAnswer,
  reveal,
  startNumber = 1,
  flags,
  onFlag,
}: {
  passage: IeltsReadingPassage;
  answers: Answers;
  setAnswer: (id: string, v: Response) => void;
  reveal?: boolean;
  startNumber?: number;
  flags?: Set<string>;
  onFlag?: (id: string) => void;
}) {
  const numbers = useMemo(() => numberItems(passage.groups, startNumber), [passage, startNumber]);
  const evidence = reveal ? passage.groups.flatMap((g) => g.items.map((i) => i.evidence ?? '')).filter(Boolean) : [];
  return (
    <SplitPane
      left={<PassagePanel title={passage.title} subtitle={passage.subtitle} paragraphs={passage.paragraphs} evidence={evidence} />}
      right={
        <div className="space-y-8">
          {passage.groups.map((g) => (
            <GroupView key={g.id} group={g} answers={answers} setAnswer={setAnswer} reveal={reveal} numbers={numbers} flags={flags} onFlag={onFlag} />
          ))}
        </div>
      }
    />
  );
}

/* ─────────── TOEFL Complete the Words ─────────── */

export function CtwView({ set, answers, setAnswer, reveal }: { set: ToeflCtwSet; answers: Answers; setAnswer: (id: string, v: Response) => void; reveal?: boolean }) {
  const t = useT();
  const { segments } = useMemo(() => parseCtw(set.text), [set.text]);
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4 text-[14px] text-muted">{t('Completa las letras que faltan en el párrafo.', 'Fill in the missing letters in the paragraph.')} <span className="font-medium text-ink">Fill in the missing letters in the paragraph.</span></p>
      <div className="rounded-2xl border border-line bg-surface p-5 text-[17px] leading-[2.6] sm:p-7">
        <h2 className="mb-2 text-lg leading-tight font-bold">{set.title}</h2>
        {segments.map((seg, i) => {
          if (typeof seg === 'string') return <span key={i}>{seg}</span>;
          const id = `b${seg.index}`;
          const val = typeof answers[id] === 'string' ? (answers[id] as string) : '';
          const ok = reveal ? checkCtwBlank(seg, val) : null;
          return (
            <span key={i} className="inline-flex items-baseline whitespace-nowrap">
              <span className="font-medium">{seg.shown}</span>
              <input
                aria-label={`${t('Hueco', 'Blank')} ${seg.index + 1}: ${seg.shown}…`}
                value={val}
                placeholder={'_'.repeat(seg.missing)}
                maxLength={seg.missing + 2}
                disabled={reveal}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => setAnswer(id, e.target.value.replace(/\s/g, ''))}
                className={cn(
                  'mx-px h-8 border-b-2 bg-transparent px-0.5 font-mono text-[16px] tracking-[0.18em] outline-none',
                  ok === null ? 'border-line-strong focus:border-accent' : ok ? 'border-good text-good' : 'border-bad text-bad line-through',
                )}
                style={{ width: `${seg.missing * 1.05 + 0.6}em` }}
              />
              {reveal && !ok && <span className="ml-0.5 font-mono text-[14px] font-semibold text-good">{seg.full.slice(seg.shown.length)}</span>}
            </span>
          );
        })}
      </div>
      {reveal && set.explanation && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-muted">{set.explanation}</p>}
    </div>
  );
}

export function ctwAnswerItems(set: ToeflCtwSet, answers: Answers) {
  const { blanks } = parseCtw(set.text);
  return blanks.map((b) => {
    const v = typeof answers[`b${b.index}`] === 'string' ? (answers[`b${b.index}`] as string) : '';
    const ok = checkCtwBlank(b, v);
    return { qid: `${set.id}#b${b.index}`, qtype: 'ctw', earned: ok ? 1 : 0, max: 1, correct: ok, response: v };
  });
}

/* ─────────── TOEFL Build a Sentence ─────────── */

export function buildChunks(item: ToeflBuildItem) {
  return seededShuffle([...item.answer, ...item.distractors], item.id);
}

export function buildCorrect(item: ToeflBuildItem, order: number[] | undefined) {
  if (!order) return false;
  const chunks = buildChunks(item);
  const said = order.map((i) => chunks[i]).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return said === item.answer.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function BuildView({ item, value, onChange, reveal }: { item: ToeflBuildItem; value: Response; onChange: (v: Response) => void; reveal?: boolean }) {
  const t = useT();
  const chunks = useMemo(() => buildChunks(item), [item]);
  const order = Array.isArray(value) ? value : [];
  const correct = reveal ? buildCorrect(item, order) : null;
  const slots = item.answer.length;
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-4 text-[14px] text-muted">{t('Ordena los fragmentos para formar una frase correcta.', 'Make an appropriate sentence.')}</p>
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold text-muted">{item.context.name[0]}</span>
          <div className="rounded-2xl rounded-tl-sm bg-surface-2 px-3.5 py-2.5 text-[15px]">{item.context.text}</div>
        </div>
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">{item.respondent[0]}</span>
          <div className={cn('flex min-h-12 flex-1 flex-wrap items-center gap-1.5 rounded-2xl rounded-tl-sm border-2 border-dashed px-3 py-2 text-[15px]', correct === null ? 'border-line-strong' : correct ? 'border-good bg-good-soft' : 'border-bad bg-bad-soft')}>
            {item.prefix && <span>{item.prefix}</span>}
            {Array.from({ length: slots }, (_, k) => {
              const ci = order[k];
              return ci !== undefined ? (
                <button
                  key={k}
                  disabled={reveal}
                  onClick={() => onChange(order.filter((_, j) => j !== k))}
                  className="rounded-lg border border-accent bg-accent-soft px-2 py-1 text-[14.5px] font-medium text-accent"
                >
                  {chunks[ci]}
                </button>
              ) : (
                <span key={k} className="inline-block h-8 w-14 rounded-lg border-b-2 border-line-strong" aria-hidden />
              );
            })}
            {item.suffix && <span>{item.suffix}</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label={t('Fragmentos disponibles', 'Available chunks')}>
        {chunks.map((c, i) =>
          order.includes(i) ? (
            <span key={i} className="rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[14.5px] text-transparent select-none">
              {c}
            </span>
          ) : (
            <button
              key={i}
              disabled={reveal || order.length >= slots}
              onClick={() => onChange([...order, i])}
              className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[14.5px] font-medium shadow-sm hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {c}
            </button>
          ),
        )}
        {!reveal && order.length > 0 && (
          <button onClick={() => onChange(order.slice(0, -1))} className="ml-auto flex items-center gap-1 rounded-lg px-2 text-[13px] text-muted hover:text-ink">
            <Undo2 size={14} /> {t('Deshacer', 'Undo')}
          </button>
        )}
      </div>
      {reveal && (
        <div className={cn('mt-4 rounded-xl border p-3 text-[14px]', correct ? 'border-good/30 bg-good-soft' : 'border-bad/30 bg-bad-soft')}>
          <div className={cn('font-semibold', correct ? 'text-good' : 'text-bad')}>{correct ? t('¡Correcto!', 'Correct!') : t('No es correcto', 'Not correct')}</div>
          <div className="mt-1">
            {item.prefix} <strong>{item.answer.join(' ')}</strong> {item.suffix}
          </div>
          <div className="mt-1 text-muted">{item.explanation}</div>
          {item.distractors.length > 0 && <div className="mt-1 text-xs text-faint">{t('Sobraba', 'Extra chunk')}: «{item.distractors.join('», «')}»</div>}
        </div>
      )}
      {!reveal && (
        <p className="mt-3 flex items-center gap-1 text-xs text-faint">
          <Shuffle size={12} /> {t('Pulsa los fragmentos en orden; pulsa uno colocado para quitarlo.', 'Tap chunks in order; tap a placed chunk to remove it.')}
        </p>
      )}
    </div>
  );
}

/* ─────────── Transcripción ─────────── */

export function Transcript({ audio, evidence = [] }: { audio: Audio; evidence?: string[] }) {
  const sp = Object.fromEntries(audio.speakers.map((s) => [s.id, s]));
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-surface p-4 text-[14.5px] leading-relaxed">
      {audio.lines.map((l, i) => (
        <div key={i} className="flex gap-3">
          <span className="w-20 shrink-0 truncate text-[12.5px] font-semibold text-muted">{sp[l.s]?.name ?? l.s}</span>
          <Highlightable as="span" text={l.t} evidence={evidence} className="flex-1" />
        </div>
      ))}
    </div>
  );
}
