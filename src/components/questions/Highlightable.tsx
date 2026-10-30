import { useRef } from 'react';
import { cn } from '@/lib/cn';

export interface Range {
  start: number;
  end: number;
}

/** Calcula offsets de la selección relativos al texto plano del elemento. */
function selectionOffsets(el: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  const end = start + r.toString().length;
  return end > start ? { start, end } : null;
}

function findAll(text: string, needle: string): Range[] {
  if (!needle) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, '-');
  const t = norm(text);
  const n = norm(needle).replace(/\s+/g, ' ').trim();
  const out: Range[] = [];
  // tolera espacios múltiples del texto original
  const compact = t.replace(/\s+/g, ' ');
  let idx = compact.indexOf(n);
  if (idx < 0) return out;
  // mapea índice compacto → índice original
  const map: number[] = [];
  for (let i = 0, prevSpace = false; i < t.length; i++) {
    const sp = /\s/.test(t[i]);
    if (sp && prevSpace) continue;
    map.push(i);
    prevSpace = sp;
  }
  while (idx >= 0) {
    out.push({ start: map[idx], end: map[idx + n.length - 1] + 1 });
    idx = compact.indexOf(n, idx + 1);
  }
  return out;
}

/**
 * Texto con resaltador del alumno (amarillo) y evidencia de la corrección (verde).
 * Pulsa sobre un resaltado para quitarlo.
 */
export function Highlightable({
  text,
  highlights = [],
  evidence = [],
  onHighlight,
  onRemove,
  className,
  as: Tag = 'p',
}: {
  text: string;
  highlights?: Range[];
  evidence?: string[];
  onHighlight?: (r: Range) => void;
  onRemove?: (index: number) => void;
  className?: string;
  as?: 'p' | 'div' | 'span';
}) {
  const ref = useRef<HTMLElement>(null);
  const ev = evidence.flatMap((e) => findAll(text, e));
  // Cortes en todos los límites
  const cuts = new Set<number>([0, text.length]);
  for (const r of [...highlights, ...ev]) {
    cuts.add(Math.max(0, r.start));
    cuts.add(Math.min(text.length, r.end));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const parts: { s: number; e: number; hl: number; ev: boolean }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i];
    const e = points[i + 1];
    const hl = highlights.findIndex((h) => h.start <= s && h.end >= e);
    const isEv = ev.some((h) => h.start <= s && h.end >= e);
    parts.push({ s, e, hl, ev: isEv });
  }
  return (
    <Tag
      ref={ref as never}
      className={cn('whitespace-pre-line', className)}
      onMouseUp={() => {
        if (!onHighlight || !ref.current) return;
        const r = selectionOffsets(ref.current);
        if (r) {
          onHighlight(r);
          window.getSelection()?.removeAllRanges();
        }
      }}
    >
      {parts.map((p) => {
        const chunk = text.slice(p.s, p.e);
        if (p.hl < 0 && !p.ev) return <span key={p.s}>{chunk}</span>;
        return (
          <mark
            key={p.s}
            className={cn(p.ev ? 'evidence' : 'hl', p.hl >= 0 && p.ev && 'outline-2 outline-[var(--hl)]')}
            onClick={p.hl >= 0 && onRemove ? () => onRemove(p.hl) : undefined}
            title={p.hl >= 0 ? 'Quitar resaltado' : undefined}
          >
            {chunk}
          </mark>
        );
      })}
    </Tag>
  );
}
