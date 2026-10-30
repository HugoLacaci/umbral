/**
 * i18n mínimo: los textos se escriben en línea como pares (es, en) → t('Inicio', 'Home').
 * Así cada componente es legible y no hay que mantener diccionarios separados.
 * El contenido de examen siempre está en inglés.
 */
import { useUi, type Lang } from '@/store';

export type Tx = { es: string; en: string };

export function useT() {
  const lang = useUi((s) => s.lang);
  const t = (es: string, en?: string) => (lang === 'en' && en !== undefined ? en : es);
  t.lang = lang as Lang;
  t.x = (v: Tx | string | undefined) => (v === undefined ? '' : typeof v === 'string' ? v : v[lang]);
  return t;
}

export const SKILL_LABEL: Record<string, Tx> = {
  reading: { es: 'Reading', en: 'Reading' },
  listening: { es: 'Listening', en: 'Listening' },
  writing: { es: 'Writing', en: 'Writing' },
  speaking: { es: 'Speaking', en: 'Speaking' },
};

export function dateFmt(t: number, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', opts).format(t);
}
