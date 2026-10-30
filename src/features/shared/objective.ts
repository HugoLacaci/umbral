/** Convierte respuestas de sets objetivos en AttemptItems (para práctica y simulacros). */
import type { Group, IeltsListeningPart, IeltsReadingPassage, ToeflBuildItem, ToeflCtwSet, ToeflListeningSet, ToeflReadingSet } from '@/content/schema';
import { gradeItem } from '@/engine/grading';
import { ctwAnswerItems, buildCorrect } from '@/components/questions/SetViews';
import type { Answers } from '@/components/questions/Items';
import type { AttemptItem } from '@/store';
import type { Skill } from '@/engine/plan';
import { proportionToBand } from '@/engine/scoring/toefl';
import { ieltsListeningBand, ieltsReadingBand } from '@/engine/scoring/ielts';

export const OBJECTIVE_BANKS = ['toefl.ctw', 'toefl.daily', 'toefl.passage', 'toefl.response', 'toefl.conversation', 'toefl.announcement', 'toefl.talk', 'toefl.build', 'ielts.reading', 'ielts.listening'];

export function sectionOfBank(bank: string): Skill {
  if (/ctw|daily|passage|ielts\.reading/.test(bank)) return 'reading';
  if (/response|conversation|announcement|talk|ielts\.listening/.test(bank)) return 'listening';
  if (/build|email|discussion|task1|task2/.test(bank)) return 'writing';
  return 'speaking';
}

export function groupItems(groups: Group[], answers: Answers, section: Skill, prefix: string): AttemptItem[] {
  return groups.flatMap((g) =>
    g.items.map((it) => {
      const r = gradeItem(it, answers[it.id]);
      return { qid: `${prefix}#${it.id}`, qtype: it.qtype === 'judge' ? g.qtype : it.qtype, section, earned: r.earned, max: r.max, correct: r.correct, response: answers[it.id] };
    }),
  );
}

export function objectiveItems(bank: string, set: unknown, answers: Answers): AttemptItem[] {
  const section = sectionOfBank(bank);
  switch (bank) {
    case 'toefl.ctw':
      return ctwAnswerItems(set as ToeflCtwSet, answers).map((x) => ({ ...x, section }));
    case 'toefl.build': {
      const it = set as ToeflBuildItem;
      const ok = buildCorrect(it, answers[it.id] as number[] | undefined);
      return [{ qid: it.id, qtype: 'build', section, earned: ok ? 1 : 0, max: 1, correct: ok, response: answers[it.id] }];
    }
    case 'ielts.reading':
    case 'ielts.listening': {
      const s = set as IeltsReadingPassage | IeltsListeningPart;
      return groupItems(s.groups, answers, section, s.id);
    }
    default: {
      const s = set as ToeflReadingSet | ToeflListeningSet;
      return s.questions.map((q) => {
        const r = gradeItem(q, answers[q.id]);
        return { qid: `${s.id}#${q.id}`, qtype: q.qtype, section, earned: r.earned, max: r.max, correct: r.correct, response: answers[q.id] };
      });
    }
  }
}

/** Banda orientativa de una práctica suelta (no es un simulacro: se pondera menos en el dashboard). */
export function practiceBand(bank: string, items: AttemptItem[]): number {
  const e = items.reduce((s, i) => s + i.earned, 0);
  const m = items.reduce((s, i) => s + i.max, 0);
  const p = m ? e / m : 0;
  if (bank === 'ielts.reading') return ieltsReadingBand(Math.round(p * 40));
  if (bank === 'ielts.listening') return ieltsListeningBand(Math.round(p * 40));
  return proportionToBand(p);
}
