/**
 * Validación de TODO el contenido: esquema Zod + comprobaciones de coherencia
 * (índices de respuesta, límites de palabras, evidencias literales, ids únicos...).
 * Ejecuta: npm run test:content
 */
import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BANKS, type Item, type Group } from './schema';
import { parseCtw } from '../engine/ctw';
import { countAnswerWords } from '../engine/grading';

const ROOT = join(__dirname);

/** CONTENT_FILTER=toefl/reading → valida sólo los archivos cuya ruta contenga ese texto. */
const FILTER = process.env.CONTENT_FILTER;

function files(pattern: string) {
  return globSync(pattern, { cwd: ROOT })
    .filter((f) => !FILTER || f.replace(/\\/g, '/').includes(FILTER))
    .map((f) => join(ROOT, f));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

function checkItem(item: Item, where: string, source: string | null, group?: Group): string[] {
  const errs: string[] = [];
  const w = `${where} › ${item.id}`;
  if (item.kind === 'mcq') {
    if (item.answer >= item.options.length) errs.push(`${w}: answer fuera de rango`);
    if (item.optionNotes && item.optionNotes.length !== item.options.length) errs.push(`${w}: optionNotes ≠ nº opciones`);
    if (new Set(item.options.map(norm)).size !== item.options.length) errs.push(`${w}: opciones duplicadas`);
  }
  if (item.kind === 'multi') {
    if (item.answers.some((a) => a >= item.options.length)) errs.push(`${w}: answers fuera de rango`);
    if (new Set(item.answers).size !== item.answers.length) errs.push(`${w}: answers duplicados`);
  }
  if (item.kind === 'judge') {
    const ok = item.scale === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
    if (!ok.includes(item.answer)) errs.push(`${w}: answer ${item.answer} no válido para ${item.scale}`);
  }
  if (item.kind === 'gap') {
    for (const a of item.answers) {
      const { words, numbers } = countAnswerWords(a);
      if (item.allowNumber) {
        if (words > item.maxWords || numbers > 1 || words + numbers === 0)
          errs.push(`${w}: "${a}" excede ${item.maxWords} palabra(s) y/o un número`);
      } else if (words + numbers > item.maxWords) errs.push(`${w}: "${a}" excede ${item.maxWords} palabra(s)`);
    }
    if (!item.prompt && !group?.template?.includes(`{{${item.id}}}`))
      errs.push(`${w}: gap sin prompt y sin {{${item.id}}} en la plantilla`);
    if (item.prompt && !item.prompt.includes('___') && !group?.template?.includes(`{{${item.id}}}`))
      errs.push(`${w}: el prompt del gap debe contener ___`);
  }
  if (item.kind === 'match') {
    if (!group?.options?.some((o) => o.key === item.answer)) errs.push(`${w}: answer "${item.answer}" no está en group.options`);
  }
  if (item.evidence && source !== null && !norm(source).includes(norm(item.evidence)))
    errs.push(`${w}: evidence no aparece LITERALMENTE en el texto/guion: "${item.evidence.slice(0, 80)}"`);
  return errs;
}

function checkGroups(groups: Group[], where: string, source: string) {
  const errs: string[] = [];
  for (const g of groups) {
    for (const it of g.items) errs.push(...checkItem(it, `${where} › ${g.id}`, source, g));
    const placeholders = [...(g.template ?? '').matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
    for (const p of placeholders)
      if (!g.items.some((i) => i.id === p)) errs.push(`${where} › ${g.id}: placeholder {{${p}}} sin ítem`);
    if (g.diagram) {
      for (const m of g.diagram.markers)
        if (m.x < 0 || m.y < 0 || m.x > g.diagram.width || m.y > g.diagram.height)
          errs.push(`${where} › ${g.id}: marcador ${m.key} fuera del lienzo`);
    }
  }
  return errs;
}

const script = (a: { lines: { t: string }[] }) => a.lines.map((l) => l.t).join(' ');
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

describe('content banks', () => {
  for (const [key, [pattern, schema]] of Object.entries(BANKS)) {
    const fs = files(pattern);
    it(`${key} (${fs.length} archivo/s)`, () => {
      const errs: string[] = [];
      const ids = new Set<string>();
      for (const f of fs) {
        const rel = relative(ROOT, f);
        let data: unknown;
        try {
          data = JSON.parse(readFileSync(f, 'utf8'));
        } catch (e) {
          errs.push(`${rel}: JSON inválido (${(e as Error).message})`);
          continue;
        }
        if (!Array.isArray(data)) {
          errs.push(`${rel}: el archivo debe ser un array`);
          continue;
        }
        data.forEach((raw, i) => {
          const r = (schema as any).safeParse(raw);
          if (!r.success) {
            errs.push(`${rel}[${i}] (${(raw as any)?.id ?? '?'}): ${r.error.issues.map((x: any) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
            return;
          }
          const v = r.data as any;
          const where = `${rel} › ${v.id ?? i}`;
          const idKey = v.id ?? v.term;
          if (idKey) {
            if (ids.has(idKey)) errs.push(`${where}: id duplicado`);
            ids.add(idKey);
          }
          if ('usage' in v) {
            if (v.usage === 'mock' && !v.mock) errs.push(`${where}: usage=mock requiere "mock": 1|2`);
            if (v.usage === 'practice' && v.mock) errs.push(`${where}: usage=practice no debe llevar "mock"`);
          }
          if ((key.startsWith('toefl.') && ['toefl.ctw', 'toefl.daily', 'toefl.passage', 'toefl.response', 'toefl.conversation', 'toefl.announcement', 'toefl.talk'].includes(key)) && v.usage === 'mock' && !v.module)
            errs.push(`${where}: set de simulacro TOEFL R/L requiere "module"`);

          switch (key) {
            case 'toefl.ctw': {
              const parsed = parseCtw(v.text);
              if (parsed.blanks.length !== 10) errs.push(`${where}: Complete the Words necesita 10 huecos (tiene ${parsed.blanks.length})`);
              for (const b of parsed.blanks)
                if (!b.full.startsWith(b.shown) || b.shown.length >= b.full.length || b.shown.length < 1)
                  errs.push(`${where}: hueco mal formado [[${b.full}|${b.shown}]]`);
              break;
            }
            case 'toefl.daily':
            case 'toefl.passage':
              for (const q of v.questions) errs.push(...checkItem(q, where, v.text));
              if (key === 'toefl.passage' && (wordCount(v.text) < 150 || wordCount(v.text) > 330))
                errs.push(`${where}: Academic Passage debería tener ~180–300 palabras (tiene ${wordCount(v.text)})`);
              break;
            case 'toefl.response':
            case 'toefl.conversation':
            case 'toefl.announcement':
            case 'toefl.talk': {
              const sp = new Set(v.audio.speakers.map((s: any) => s.id));
              for (const l of v.audio.lines) if (!sp.has(l.s)) errs.push(`${where}: línea con speaker desconocido "${l.s}"`);
              for (const q of v.questions) errs.push(...checkItem(q, where, script(v.audio)));
              break;
            }
            case 'toefl.build': {
              const all = [...v.answer, ...v.distractors];
              if (new Set(all.map(norm)).size !== all.length) errs.push(`${where}: fragmentos repetidos (ambiguo)`);
              break;
            }
            case 'ielts.reading': {
              const text = v.paragraphs.map((p: any) => p.text).join(' ');
              const wc = wordCount(text);
              if (wc < 600 || wc > 1050) errs.push(`${where}: el texto debería tener 700–950 palabras (tiene ${wc})`);
              const n = v.groups.reduce((s: number, g: any) => s + g.items.reduce((x: number, i: any) => x + (i.kind === 'multi' ? i.answers.length : 1), 0), 0); // puntos: multi = 1 por letra
              if (n < 12 || n > 14) errs.push(`${where}: un texto IELTS lleva 13–14 preguntas (tiene ${n})`);
              errs.push(...checkGroups(v.groups, where, text));
              break;
            }
            case 'ielts.listening': {
              const sp = new Set(v.audio.speakers.map((s: any) => s.id));
              for (const l of v.audio.lines) if (!sp.has(l.s)) errs.push(`${where}: línea con speaker desconocido "${l.s}"`);
              const n = v.groups.reduce((s: number, g: any) => s + g.items.reduce((x: number, i: any) => x + (i.kind === 'multi' ? i.answers.length : 1), 0), 0); // puntos: multi = 1 por letra
              if (n !== 10) errs.push(`${where}: cada parte de Listening lleva 10 preguntas (tiene ${n})`);
              errs.push(...checkGroups(v.groups, where, script(v.audio)));
              break;
            }
            case 'study.drills':
              if (v.type === 'mcq' && !(v.options ?? []).includes(v.answers[0])) errs.push(`${where}: answers[0] no está en options`);
              break;
            case 'study.grammar':
              for (const d of v.exercises)
                if (d.type === 'mcq' && !(d.options ?? []).includes(d.answers[0])) errs.push(`${where} › ${d.id}: answers[0] no está en options`);
              break;
          }
        });
      }
      expect(errs, errs.join('\n')).toEqual([]);
    });
  }
});
