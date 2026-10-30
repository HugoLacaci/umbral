import { describe, expect, it } from 'vitest';
import { countAnswerWords, gradeGap, gradeItem, normalizeAnswer } from './grading';
import { parseCtw, checkCtwBlank, ctwPlain } from './ctw';
import type { GapItem } from '@/content/schema';

const gap = (answers: string[], maxWords = 2, allowNumber = true): GapItem => ({
  id: 'q', kind: 'gap', qtype: 'note-completion', explanation: 'xxxxxxxxxx', answers, maxWords, allowNumber,
});

describe('huecos IELTS', () => {
  it('cuenta palabras y números', () => {
    expect(countAnswerWords('15 March')).toEqual({ words: 1, numbers: 1 });
    expect(countAnswerWords('part-time job')).toEqual({ words: 2, numbers: 0 });
    expect(countAnswerWords('£4.50')).toEqual({ words: 0, numbers: 1 });
  });
  it('acepta mayúsculas, espacios y variantes', () => {
    expect(gradeGap(gap(['colour', 'color']), 'Color').correct).toBe(true);
    expect(gradeGap(gap(['car park']), '  car   park ').correct).toBe(true);
    expect(gradeGap(gap(['1200']), '1,200').correct).toBe(true);
    expect(gradeGap(gap(['part-time']), 'part time').correct).toBe(true);
  });
  it('penaliza exceder el límite aunque contenga la respuesta', () => {
    const r = gradeGap(gap(['library'], 1, false), 'the main library');
    expect(r).toMatchObject({ correct: false, reason: 'too-many-words' });
  });
  it('NO MORE THAN TWO WORDS AND/OR A NUMBER', () => {
    expect(gradeGap(gap(['15 March'], 2, true), '15 March').correct).toBe(true);
    expect(gradeGap(gap(['x'], 2, true), 'three big red').reason).toBe('too-many-words');
  });
  it('acepta teléfonos con espacios y moneda repetida', () => {
    expect(gradeGap(gap(['07816443902'], 1, true), '07816 443902').correct).toBe(true);
    expect(gradeGap(gap(['52'], 1, true), '£52').correct).toBe(true);
  });
  it('la mala ortografía es error pero se detecta', () => {
    expect(gradeGap(gap(['accommodation'], 1), 'accomodation')).toMatchObject({ correct: false, reason: 'spelling' });
    expect(gradeGap(gap(['bus'], 1), 'train')).toMatchObject({ correct: false, reason: 'wrong' });
    expect(gradeGap(gap(['bus'], 1), '')).toMatchObject({ reason: 'blank' });
  });
  it('normaliza', () => {
    expect(normalizeAnswer(' The “Museum”. ')).toBe('the museum');
  });
});

describe('otros ítems', () => {
  it('multi vale un punto por letra y no premia marcar de más', () => {
    const item = { id: 'm', kind: 'multi', qtype: 'multi', explanation: 'xxxxxxxxxx', prompt: '', options: ['a', 'b', 'c', 'd', 'e'], answers: [1, 3] } as const;
    expect(gradeItem(item as any, [1, 3])).toMatchObject({ earned: 2, max: 2 });
    expect(gradeItem(item as any, [1, 2])).toMatchObject({ earned: 1, max: 2 });
    expect(gradeItem(item as any, [0, 2, 1, 3])).toMatchObject({ earned: 0 });
  });
  it('judge y match', () => {
    expect(gradeItem({ id: 'j', kind: 'judge', qtype: 'tfng', explanation: 'xxxxxxxxxx', statement: '', scale: 'tfng', answer: 'NOT GIVEN' }, 'not given').correct).toBe(true);
    expect(gradeItem({ id: 'k', kind: 'match', qtype: 'matching', explanation: 'xxxxxxxxxx', prompt: '', answer: 'iv' }, 'IV').correct).toBe(true);
  });
});

describe('Complete the Words', () => {
  const text = 'Bees are social insects. They [[live|li]] in large [[colonies|colo]] that work together.';
  it('parsea huecos', () => {
    const { blanks, segments } = parseCtw(text);
    expect(blanks).toHaveLength(2);
    expect(blanks[1]).toMatchObject({ full: 'colonies', shown: 'colo', missing: 4 });
    expect(segments[0]).toBe('Bees are social insects. They ');
  });
  it('corrige', () => {
    const { blanks } = parseCtw(text);
    expect(checkCtwBlank(blanks[0], 've')).toBe(true);
    expect(checkCtwBlank(blanks[1], 'NIES')).toBe(true);
    expect(checkCtwBlank(blanks[1], 'nys')).toBe(false);
    expect(ctwPlain(text)).toBe('Bees are social insects. They live in large colonies that work together.');
  });
});
