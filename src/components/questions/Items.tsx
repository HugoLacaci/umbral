import { Fragment, type ReactNode } from 'react';
import { Check, X, Flag } from 'lucide-react';
import type { Diagram, GapItem, Group, Item, McqItem } from '@/content/schema';
import { gradeItem, itemMax, correctAnswerText, type Response } from '@/engine/grading';
import { cn, letter } from '@/lib/cn';
import { useT } from '@/i18n';

export type Answers = Record<string, Response>;

/* ─────────── Numeración ─────────── */

export function numberItems(groups: { items: Item[] }[], start = 1): Map<string, string> {
  const m = new Map<string, string>();
  let n = start;
  for (const g of groups)
    for (const it of g.items) {
      const k = itemMax(it);
      m.set(it.id, k > 1 ? `${n}–${n + k - 1}` : String(n));
      n += k;
    }
  return m;
}

export function countQuestions(groups: { items: Item[] }[]) {
  return groups.reduce((s, g) => s + g.items.reduce((x, i) => x + itemMax(i), 0), 0);
}

/* ─────────── Feedback ─────────── */

export function Feedback({ item, value, options }: { item: Item; value: Response; options?: { key: string; text: string }[] }) {
  const t = useT();
  const r = gradeItem(item, value);
  return (
    <div className={cn('mt-2 rounded-xl border px-3 py-2.5 text-[13.5px] leading-relaxed', r.correct ? 'border-good/30 bg-good-soft' : 'border-bad/30 bg-bad-soft')}>
      <div className={cn('flex items-center gap-1.5 font-semibold', r.correct ? 'text-good' : 'text-bad')}>
        {r.correct ? <Check size={15} /> : <X size={15} />}
        {r.correct
          ? t('Correcto', 'Correct')
          : r.reason === 'blank'
            ? t('Sin responder', 'Not answered')
            : r.reason === 'too-many-words'
              ? t('Excede el límite de palabras (en el examen cuenta como error)', 'Over the word limit (marked wrong in the exam)')
              : r.reason === 'spelling'
                ? t('Casi: error de ortografía (en el examen cuenta como error)', 'Close: spelling mistake (marked wrong in the exam)')
                : t('Incorrecto', 'Incorrect')}
        {item.kind === 'multi' && ` · ${r.earned}/${r.max}`}
      </div>
      {!r.correct && (
        <div className="mt-1 text-ink">
          {t('Respuesta correcta', 'Correct answer')}: <strong>{correctAnswerText(item, options)}</strong>
          {item.kind === 'gap' && item.answers.length > 1 && <span className="text-muted"> ({t('también', 'also')}: {item.answers.slice(1).join(' / ')})</span>}
        </div>
      )}
      <div className="mt-1 text-muted">{item.explanation}</div>
      {item.evidence && (
        <div className="mt-1.5 border-l-2 border-good pl-2 font-serif text-[13.5px] text-ink italic">“{item.evidence}”</div>
      )}
    </div>
  );
}

/* ─────────── MCQ ─────────── */

export function McqView({
  item,
  value,
  onChange,
  reveal,
  number,
  hidePrompt,
}: {
  item: McqItem;
  value: Response;
  onChange: (v: Response) => void;
  reveal?: boolean;
  number?: string;
  hidePrompt?: boolean;
}) {
  return (
    <fieldset>
      {!hidePrompt && (
        <legend className="mb-2.5 text-[15px] leading-snug font-medium">
          {number && <span className="mr-2 font-semibold text-accent">{number}</span>}
          {item.prompt}
        </legend>
      )}
      <div className="space-y-2" role="radiogroup">
        {item.options.map((o, i) => {
          const sel = value === i;
          const right = reveal && i === item.answer;
          const wrong = reveal && sel && i !== item.answer;
          return (
            <div key={i}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-[14.5px] transition-colors',
                  right ? 'border-good bg-good-soft' : wrong ? 'border-bad bg-bad-soft' : sel ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                  reveal && 'cursor-default',
                )}
              >
                <input type="radio" className="sr-only" name={item.id} checked={sel} disabled={reveal} onChange={() => onChange(i)} />
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold',
                    sel ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-muted',
                    right && 'border-good bg-good text-white',
                    wrong && 'border-bad bg-bad text-white',
                  )}
                >
                  {letter(i)}
                </span>
                <span className="pt-0.5">{o}</span>
              </label>
              {reveal && item.optionNotes?.[i] && (sel || i === item.answer) && <p className="mt-1 ml-12 text-[12.5px] text-muted">{item.optionNotes[i]}</p>}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ─────────── Inputs inline ─────────── */

export function GapInput({ item, value, onChange, reveal, number }: { item: GapItem; value: Response; onChange: (v: Response) => void; reveal?: boolean; number?: string }) {
  const r = reveal ? gradeItem(item, value) : null;
  const v = typeof value === 'string' ? value : '';
  return (
    <span className="mx-0.5 inline-flex items-baseline gap-1 align-baseline">
      {number && <span className="text-[12px] font-bold text-accent">{number}</span>}
      <input
        aria-label={`Question ${number ?? item.id}`}
        value={v}
        disabled={reveal}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className={cn(
          'h-8 min-w-[7.5rem] rounded-md border bg-surface px-2 font-sans text-[14.5px] outline-none focus:border-accent',
          r ? (r.correct ? 'border-good bg-good-soft' : 'border-bad bg-bad-soft') : 'border-line-strong',
        )}
        style={{ width: `${Math.max(8, v.length + 2)}ch` }}
      />
      {r && !r.correct && <span className="text-[13px] font-semibold text-good">{item.answers[0]}</span>}
    </span>
  );
}

export function MatchSelect({
  itemId,
  value,
  onChange,
  options,
  reveal,
  correct,
  number,
  wide,
}: {
  itemId: string;
  value: Response;
  onChange: (v: Response) => void;
  options: { key: string; text: string }[];
  reveal?: boolean;
  correct?: string;
  number?: string;
  wide?: boolean;
}) {
  const ok = reveal ? typeof value === 'string' && value.toLowerCase() === correct?.toLowerCase() : null;
  return (
    <span className="mx-0.5 inline-flex items-baseline gap-1">
      {number && <span className="text-[12px] font-bold text-accent">{number}</span>}
      <select
        aria-label={`Question ${number ?? itemId}`}
        value={typeof value === 'string' ? value : ''}
        disabled={reveal}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          'h-8 rounded-md border bg-surface px-1.5 text-[14px] outline-none focus:border-accent',
          wide ? 'max-w-[18rem]' : 'max-w-[7rem]',
          ok === null ? 'border-line-strong' : ok ? 'border-good bg-good-soft' : 'border-bad bg-bad-soft',
        )}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {wide ? `${o.key}  ${o.text}` : o.key}
          </option>
        ))}
      </select>
      {reveal && !ok && <span className="text-[13px] font-semibold text-good">{correct}</span>}
    </span>
  );
}

/* ─────────── Diagrama / mapa ─────────── */

const FILL: Record<string, string> = {
  building: 'var(--surface-3)',
  room: 'var(--surface-2)',
  road: 'color-mix(in oklab, var(--muted) 30%, var(--surface))',
  path: 'color-mix(in oklab, var(--warn) 18%, var(--surface))',
  water: 'color-mix(in oklab, #3b82f6 28%, var(--surface))',
  park: 'color-mix(in oklab, #22c55e 22%, var(--surface))',
  trees: 'color-mix(in oklab, #16a34a 35%, var(--surface))',
  parking: 'color-mix(in oklab, var(--muted) 15%, var(--surface))',
  field: 'color-mix(in oklab, #a3e635 20%, var(--surface))',
};

export function DiagramView({ d, labels, title }: { d: Diagram; labels?: Map<string, string>; title?: string }) {
  return (
    <figure className="my-3">
      {title && <figcaption className="mb-1.5 text-center text-[13px] font-semibold">{title}</figcaption>}
      <svg viewBox={`0 0 ${d.width} ${d.height}`} className="h-auto w-full max-w-[640px] rounded-xl border border-line bg-surface" role="img" aria-label={title ?? 'Diagram'}>
        {d.shapes.map((s, i) => {
          if (s.kind === 'label')
            return (
              <text key={i} x={s.x} y={s.y} fontSize={13} fill="var(--ink)" textAnchor="middle" fontWeight={600}>
                {s.label}
              </text>
            );
          if (s.kind === 'arrow')
            return (
              <g key={i}>
                <defs>
                  <marker id={`ah-${i}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" />
                  </marker>
                </defs>
                <line x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} stroke="var(--muted)" strokeWidth={2} markerEnd={`url(#ah-${i})`} />
                {s.label && (
                  <text x={s.x + s.w / 2} y={s.y + s.h / 2 - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">
                    {s.label}
                  </text>
                )}
              </g>
            );
          const round = s.kind === 'trees' || s.kind === 'water' ? 18 : s.kind === 'building' || s.kind === 'room' ? 4 : 2;
          return (
            <g key={i}>
              <rect x={s.x} y={s.y} width={Math.max(s.w, 1)} height={Math.max(s.h, 1)} rx={round} fill={FILL[s.kind] ?? 'var(--surface-2)'} stroke="var(--line-strong)" strokeWidth={s.kind === 'road' || s.kind === 'path' ? 0 : 1} />
              {s.label && (
                <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 4} fontSize={Math.min(15, Math.max(12, (s.w / Math.max(6, s.label.length)) * 1.6))} textAnchor="middle" fill="var(--ink)">
                  {s.label}
                </text>
              )}
            </g>
          );
        })}
        {d.markers.map((m) => {
          const lab = labels?.get(m.key) ?? m.key;
          return (
            <g key={m.key}>
              <circle cx={m.x} cy={m.y} r={13} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
              <text x={m.x} y={m.y + 4.5} fontSize={lab.length > 2 ? 10 : 13} fontWeight={700} textAnchor="middle" fill="var(--accent-ink)">
                {lab}
              </text>
            </g>
          );
        })}
        {d.compass && (
          <g transform={`translate(${d.width - 26}, 30)`}>
            <path d="M0,-16 L6,4 L0,0 L-6,4 z" fill="var(--ink)" />
            <text y={18} fontSize={11} textAnchor="middle" fill="var(--ink)" fontWeight={700}>
              N
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}

/* ─────────── Grupo IELTS ─────────── */

function inlineMd(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}

export function GroupView({
  group,
  answers,
  setAnswer,
  reveal,
  numbers,
  flags,
  onFlag,
}: {
  group: Group;
  answers: Answers;
  setAnswer: (id: string, v: Response) => void;
  reveal?: boolean;
  numbers: Map<string, string>;
  flags?: Set<string>;
  onFlag?: (id: string) => void;
}) {
  const byId = new Map(group.items.map((i) => [i.id, i]));
  const inTemplate = new Set([...(group.template ?? '').matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]));
  const opts = group.options ?? [];
  const wideOpts = opts.some((o) => o.text.length > 3);

  const renderSlot = (id: string) => {
    const it = byId.get(id);
    if (!it) return null;
    if (it.kind === 'gap') return <GapInput key={id} item={it} value={answers[id]} onChange={(v) => setAnswer(id, v)} reveal={reveal} number={numbers.get(id)} />;
    if (it.kind === 'match')
      return <MatchSelect key={id} itemId={id} value={answers[id]} onChange={(v) => setAnswer(id, v)} options={opts} reveal={reveal} correct={it.answer} number={numbers.get(id)} />;
    return null;
  };

  const renderLine = (line: string, i: number) => {
    const parts = line.split(/\{\{([^}]+)\}\}/g);
    return parts.map((p, j) => (j % 2 ? renderSlot(p) : <Fragment key={`${i}-${j}`}>{inlineMd(p)}</Fragment>));
  };

  // Plantilla: tablas markdown + líneas
  const templateBlocks: ReactNode[] = [];
  if (group.template) {
    const lines = group.template.split('\n');
    let table: string[][] = [];
    const flush = (key: number) => {
      if (!table.length) return;
      const rows = table.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c.trim())));
      templateBlocks.push(
        <div key={`t${key}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => {
                    const Cell = ri === 0 ? 'th' : 'td';
                    return (
                      <Cell key={ci} className={cn('border border-line px-2 py-1.5 text-left align-top', ri === 0 && 'bg-surface-2 font-semibold')}>
                        {renderLine(c.trim(), ri * 100 + ci)}
                      </Cell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      table = [];
    };
    lines.forEach((line, i) => {
      if (/^\s*\|/.test(line)) {
        table.push(line.trim().replace(/^\||\|$/g, '').split('|'));
        return;
      }
      flush(i);
      const bullet = /^\s*[-•*]\s+/.test(line);
      const clean = line.replace(/^\s*[-•*]\s+/, '');
      if (!clean.trim()) {
        templateBlocks.push(<div key={i} className="h-2" />);
        return;
      }
      templateBlocks.push(
        <div key={i} className={cn('leading-9', bullet && 'flex gap-2 pl-2')}>
          {bullet && <span className="text-accent">•</span>}
          <span>{renderLine(clean, i)}</span>
        </div>,
      );
    });
    flush(lines.length);
  }

  // Etiquetas de marcadores: si el marcador es un id de ítem, muestra su número
  const markerLabels = new Map<string, string>();
  group.diagram?.markers.forEach((m) => markerLabels.set(m.key, numbers.get(m.key) ?? m.key));

  const loose = group.items.filter((i) => !inTemplate.has(i.id));
  const isHeadings = group.qtype === 'matching-headings';
  const showOptionsBox = opts.length > 0 && (wideOpts || isHeadings);

  return (
    <section className="space-y-3" aria-label={group.instructions.split('\n')[0]}>
      <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-line">
        {group.instructions.split('\n').map((l, i) => (
          <div key={i} className={i === 0 ? 'font-bold' : /[A-Z]{3,}/.test(l) ? 'font-medium' : ''}>
            {l}
          </div>
        ))}
      </div>
      {group.diagram && <DiagramView d={group.diagram} labels={markerLabels} title={group.title} />}
      {showOptionsBox && (
        <div className="rounded-xl border border-line px-3.5 py-2.5">
          {isHeadings && <div className="mb-1 text-[13px] font-bold">List of Headings</div>}
          <ul className="space-y-1 text-[14px]">
            {opts.map((o) => (
              <li key={o.key} className="flex gap-2.5">
                <span className="w-7 shrink-0 font-semibold">{o.key}</span>
                <span>{o.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {group.template && (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[14.5px]">
          {group.title && !group.diagram && <div className="mb-1 text-center font-bold">{group.title}</div>}
          {templateBlocks}
        </div>
      )}
      {reveal &&
        group.items
          .filter((i) => inTemplate.has(i.id))
          .map((i) => (
            <div key={i.id} className="text-[13px]">
              <span className="font-semibold text-accent">{numbers.get(i.id)}</span>
              <Feedback item={i} value={answers[i.id]} options={opts} />
            </div>
          ))}
      <div className="space-y-4">
        {loose.map((it) => (
          <div key={it.id} id={`q-${it.id}`} className="scroll-mt-24">
            <LooseItem
              item={it}
              number={numbers.get(it.id)}
              value={answers[it.id]}
              onChange={(v) => setAnswer(it.id, v)}
              reveal={reveal}
              options={opts}
              flagged={flags?.has(it.id)}
              onFlag={onFlag ? () => onFlag(it.id) : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function LooseItem({
  item,
  number,
  value,
  onChange,
  reveal,
  options,
  flagged,
  onFlag,
}: {
  item: Item;
  number?: string;
  value: Response;
  onChange: (v: Response) => void;
  reveal?: boolean;
  options: { key: string; text: string }[];
  flagged?: boolean;
  onFlag?: () => void;
}) {
  const t = useT();
  const flagBtn = onFlag && (
    <button
      onClick={onFlag}
      aria-pressed={flagged}
      title={t('Marcar para revisar', 'Mark for review')}
      className={cn('ml-auto shrink-0 rounded-md p-1', flagged ? 'text-warn' : 'text-faint hover:text-muted')}
    >
      <Flag size={15} fill={flagged ? 'currentColor' : 'none'} />
    </button>
  );
  let body: ReactNode;
  switch (item.kind) {
    case 'mcq':
      body = (
        <>
          <div className="mb-2 flex items-start gap-2 text-[15px] font-medium">
            <span className="font-semibold text-accent">{number}</span>
            <span className="flex-1">{item.prompt}</span>
            {flagBtn}
          </div>
          <McqView item={item} value={value} onChange={onChange} reveal={reveal} hidePrompt />
        </>
      );
      break;
    case 'multi': {
      const sel = Array.isArray(value) ? value : [];
      body = (
        <>
          <div className="mb-2 flex items-start gap-2 text-[15px] font-medium">
            <span className="font-semibold text-accent">{number}</span>
            <span className="flex-1">{item.prompt}</span>
            {flagBtn}
          </div>
          <div className="space-y-2">
            {item.options.map((o, i) => {
              const on = sel.includes(i);
              const right = reveal && item.answers.includes(i);
              const wrong = reveal && on && !item.answers.includes(i);
              return (
                <label
                  key={i}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-[14.5px]',
                    right ? 'border-good bg-good-soft' : wrong ? 'border-bad bg-bad-soft' : on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-[var(--accent)]"
                    checked={on}
                    disabled={reveal || (!on && sel.length >= item.answers.length)}
                    onChange={() => onChange(on ? sel.filter((x) => x !== i) : [...sel, i])}
                  />
                  <span className="font-semibold">{letter(i)}</span>
                  <span>{o}</span>
                </label>
              );
            })}
          </div>
        </>
      );
      break;
    }
    case 'judge': {
      const opts = item.scale === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
      body = (
        <div>
          <div className="mb-2 flex items-start gap-2 text-[15px]">
            <span className="font-semibold text-accent">{number}</span>
            <span className="flex-1">{item.statement}</span>
            {flagBtn}
          </div>
          <div className="flex flex-wrap gap-2 pl-6" role="radiogroup">
            {opts.map((o) => {
              const on = value === o;
              const right = reveal && o === item.answer;
              const wrong = reveal && on && o !== item.answer;
              return (
                <button
                  key={o}
                  role="radio"
                  aria-checked={on}
                  disabled={reveal}
                  onClick={() => onChange(o)}
                  className={cn(
                    'h-9 rounded-lg border px-3 text-[13px] font-semibold tracking-wide transition-colors',
                    right ? 'border-good bg-good text-white' : wrong ? 'border-bad bg-bad text-white' : on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface text-muted hover:text-ink',
                  )}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      );
      break;
    }
    case 'match':
      body = (
        <div className="flex flex-wrap items-center gap-2 text-[15px]">
          <span className="font-semibold text-accent">{number}</span>
          <span className="flex-1">{item.prompt}</span>
          <MatchSelect itemId={item.id} value={value} onChange={onChange} options={options} reveal={reveal} correct={item.answer} wide={options.some((o) => o.text.length > 3) && options.length <= 8 && !/^[ivx]+$/i.test(options[0]?.key ?? '')} />
          {flagBtn}
        </div>
      );
      break;
    case 'gap': {
      const parts = (item.prompt ?? '___').split('___');
      body = (
        <div className="flex items-start gap-2 text-[15px] leading-9">
          <span className="font-semibold text-accent">{number}</span>
          <span className="flex-1">
            {parts.map((p, i) => (
              <Fragment key={i}>
                {p}
                {i < parts.length - 1 && <GapInput item={item} value={value} onChange={onChange} reveal={reveal} />}
              </Fragment>
            ))}
          </span>
          {flagBtn}
        </div>
      );
      break;
    }
  }
  return (
    <div>
      {body}
      {reveal && item.kind !== 'gap' && <Feedback item={item} value={value} options={options} />}
      {reveal && item.kind === 'gap' && <Feedback item={item} value={value} />}
    </div>
  );
}
