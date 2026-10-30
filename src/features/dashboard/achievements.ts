import { streak, totalMinutes } from '@/store';
import type { useApp } from '@/store';

type S = ReturnType<typeof useApp.getState>;

/** Logros discretos: se calculan a partir del progreso, no se guardan aparte. */
export function achievements(s: S) {
  const mins = totalMinutes(s.activity);
  const st = streak(s.activity);
  const mocks = s.attempts.filter((a) => a.kind === 'mock').length;
  const reviewed = Object.keys(s.srs).length;
  const correct = s.attempts.reduce((n, a) => n + a.items.filter((i) => i.correct).length, 0);
  const list = [
    { id: 'first', icon: '🌱', title: { es: 'Primer paso', en: 'First step' }, desc: { es: 'Completa tu primer ejercicio', en: 'Finish your first exercise' }, unlocked: s.attempts.length > 0 },
    { id: 'streak7', icon: '🔥', title: { es: 'Racha de 7', en: '7-day streak' }, desc: { es: '7 días seguidos estudiando', en: 'Study 7 days in a row' }, unlocked: st >= 7 },
    { id: 'hours10', icon: '⏳', title: { es: '10 horas', en: '10 hours' }, desc: { es: '10 horas de estudio', en: '10 hours of study' }, unlocked: mins >= 600 },
    { id: 'mock1', icon: '🎯', title: { es: 'Primer simulacro', en: 'First mock' }, desc: { es: 'Termina un simulacro', en: 'Finish a mock test' }, unlocked: mocks >= 1 },
    { id: 'cards100', icon: '🃏', title: { es: '100 palabras', en: '100 words' }, desc: { es: 'Repasa 100 flashcards distintas', en: 'Review 100 different flashcards' }, unlocked: reviewed >= 100 },
    { id: 'correct500', icon: '✅', title: { es: '500 aciertos', en: '500 correct' }, desc: { es: '500 respuestas correctas', en: '500 correct answers' }, unlocked: correct >= 500 },
  ];
  return list;
}
