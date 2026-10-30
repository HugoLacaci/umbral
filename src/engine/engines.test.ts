import { describe, expect, it } from 'vitest';
import { newCard, review, isDue, mastery } from './srs';
import { analyzeText, estimateIeltsWriting, estimateToeflWriting, splitSentences } from './textAnalysis';
import { repeatAccuracy, repeatScore, speakingMetrics, estimateIeltsSpeaking } from './speaking';
import { buildPlan } from './plan';

const DAY = 86_400_000;

describe('SM-2', () => {
  it('progresa con respuestas correctas', () => {
    const t0 = new Date('2026-11-01T10:00:00').getTime();
    let c = newCard(t0);
    c = review(c, 'good', t0);
    expect(c.interval).toBe(1);
    c = review(c, 'good', t0 + DAY);
    expect(c.interval).toBe(6);
    c = review(c, 'good', t0 + 7 * DAY);
    expect(c.interval).toBe(15); // 6 × 2.5
    expect(mastery(c)).toBe('young');
  });
  it('reinicia al fallar y baja el EF sin pasar de 1.3', () => {
    let c = newCard(0);
    for (let i = 0; i < 10; i++) c = review(c, 'again', i);
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(10);
    expect(c.ef).toBe(1.3);
    expect(isDue(c, 11 * 60_000 + 10)).toBe(true);
  });
  it('easy da más intervalo que good', () => {
    const a = review(review(newCard(0), 'good', 0), 'good', DAY);
    const b = review(review(newCard(0), 'easy', 0), 'easy', DAY);
    expect(b.ef).toBeGreaterThan(a.ef);
  });
});

const ESSAY = `Some people believe that university education should be free for everyone. In my opinion, this policy has clear benefits, although it also creates significant costs for governments.

On the one hand, free tuition would allow talented students from low-income families to access higher education. For example, in countries such as Germany, tuition fees were abolished and participation increased. Moreover, a more educated workforce contributes to economic growth.

On the other hand, the financial burden on taxpayers is considerable. Governments would need to raise taxes or reduce spending on other essential services, which could be unpopular. However, this cost could be justified if it is seen as a long-term investment.

In conclusion, although free university education is expensive, I believe its advantages outweigh its disadvantages because it promotes equality and prosperity.`;

describe('analizador de textos', () => {
  it('cuenta palabras, frases, párrafos y conectores', () => {
    const m = analyzeText(ESSAY, new Set(['benefit', 'economic', 'finance', 'financial', 'significant', 'access', 'contribute', 'justify', 'promote', 'policy', 'considerable', 'require']));
    expect(m.words).toBeGreaterThan(120);
    expect(m.paragraphs).toBe(4);
    expect(m.sentences).toBeGreaterThanOrEqual(8);
    expect(m.connectorFunctions).toBeGreaterThanOrEqual(4);
    expect(m.awlPercent).toBeGreaterThan(0);
    expect(m.contractions).toEqual([]);
  });
  it('detecta registro informal y contracciones', () => {
    const m = analyzeText("I think kids don't learn a lot of stuff at school. It's gonna change.");
    expect(m.contractions).toEqual(expect.arrayContaining(["don't", "it's"]));
    expect(m.informal).toEqual(expect.arrayContaining(['kids', 'a lot of', 'stuff', 'gonna']));
  });
  it('separa frases', () => {
    expect(splitSentences('One. Two? Three! four')).toHaveLength(3);
  });
  it('limita la estimación si no llega al mínimo', () => {
    const short = analyzeText('Overall, sales rose. They went up a lot in 2020.');
    const r = estimateIeltsWriting(short, { task: 1, checklist: 1 });
    expect(r.criteria[0].score).toBeLessThanOrEqual(5);
    const full = estimateIeltsWriting(analyzeText(ESSAY), { task: 2, checklist: 1, lt: { grammar: 0, spelling: 0, style: 0 } });
    expect(full.band).toBeGreaterThanOrEqual(6);
    expect(full.band).toBeLessThanOrEqual(8.5);
  });
  it('TOEFL 0–5', () => {
    const r = estimateToeflWriting(analyzeText(ESSAY), { task: 'discussion', checklist: 1 });
    expect(r.score).toBeGreaterThanOrEqual(3);
    expect(r.score).toBeLessThanOrEqual(5);
  });
});

describe('speaking', () => {
  it('precisión de repetición', () => {
    expect(repeatAccuracy('The library closes at nine tonight.', 'the library closes at nine tonight').accuracy).toBe(1);
    const r = repeatAccuracy('The library closes at nine tonight.', 'the library close at night');
    expect(r.accuracy).toBeLessThan(0.8);
    expect(r.diff.some((d) => d.status === 'missing')).toBe(true);
    expect(repeatAccuracy("It's open", 'it is open').accuracy).toBeGreaterThan(0.7);
    expect(repeatScore(1)).toBe(5);
    expect(repeatScore(0.1)).toBe(0);
  });
  it('métricas y estimación', () => {
    const m = speakingMetrics('Well um I think that um my hometown is like really nice because it has a lot of parks', 10, [0.5, 2.5]);
    expect(m.wpm).toBe(114);
    expect(m.longPauses).toBe(1);
    expect(m.fillers.find((f) => f.word === 'um')?.count).toBe(2);
    const e = estimateIeltsSpeaking(m);
    expect(e.criteria).toHaveLength(4);
  });
});

describe('plan de estudio', () => {
  it('prioriza la destreza más floja y programa simulacros al final', () => {
    const now = new Date('2026-11-01T10:00:00').getTime();
    const plan = buildPlan({
      exam: 'toefl',
      examDate: now + 30 * DAY,
      targets: { reading: 4, listening: 4.5, writing: 4.5, speaking: 4 },
      current: { reading: 4.5, listening: 3.5, writing: 4, speaking: 4 },
      minutesPerDay: 60,
      now,
    });
    expect(plan.weeks.length).toBeGreaterThanOrEqual(4);
    expect(plan.focus[0]).toBe('listening');
    expect(plan.today.reduce((s, t) => s + t.minutes, 0)).toBeLessThanOrEqual(70);
    expect(plan.weeks.at(-1)!.goals.join(' ')).toMatch(/simulacro/i);
  });
});
