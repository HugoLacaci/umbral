import { useMemo } from 'react';
import { marked } from 'marked';
import { cn } from '@/lib/cn';

marked.setOptions({ gfm: true, breaks: false });

/** Renderiza markdown de contenido propio (de confianza: viene del repo, no del usuario). */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => marked.parse(source, { async: false }) as string, [source]);
  return <div className={cn('prose-u', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
