/**
 * Cargador de contenido: cada banco se carga bajo demanda (code-splitting por JSON) y se cachea.
 * Los datos ya se validan en `npm run test:content`, así que en el navegador sólo se parsean.
 */
import { useEffect, useState } from 'react';
import type * as S from './schema';
import { BANKS, type BankKey } from './schema';

export type BankTypes = {
  'toefl.ctw': S.ToeflCtwSet;
  'toefl.daily': S.ToeflReadingSet;
  'toefl.passage': S.ToeflReadingSet;
  'toefl.response': S.ToeflListeningSet;
  'toefl.conversation': S.ToeflListeningSet;
  'toefl.announcement': S.ToeflListeningSet;
  'toefl.talk': S.ToeflListeningSet;
  'toefl.build': S.ToeflBuildItem;
  'toefl.email': S.ToeflEmailTask;
  'toefl.discussion': S.ToeflDiscussionTask;
  'toefl.repeat': S.ToeflRepeatSet;
  'toefl.interview': S.ToeflInterviewSet;
  'ielts.reading': S.IeltsReadingPassage;
  'ielts.listening': S.IeltsListeningPart;
  'ielts.task1': S.IeltsTask1;
  'ielts.task2': S.IeltsTask2;
  'ielts.p1': S.IeltsSpeakingP1;
  'ielts.p2': S.IeltsSpeakingP2;
  'ielts.p3': S.IeltsSpeakingP3;
  'study.decks': S.Deck;
  'study.grammar': S.GrammarTopic;
  'study.drills': S.DrillItem;
  'study.connectors': S.ConnectorGroup;
  'study.lessons': S.Lesson;
  'study.videos': S.Video;
  'study.resources': S.Resource;
};

const loaders = import.meta.glob<unknown[]>('./**/*.json', { import: 'default' });

function globToRegex(glob: string): RegExp {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^\\./${re}$`);
}

const cache = new Map<string, Promise<unknown[]>>();

export function loadBank<K extends BankKey>(key: K): Promise<BankTypes[K][]> {
  if (!cache.has(key)) {
    const re = globToRegex(BANKS[key][0]);
    const paths = Object.keys(loaders)
      .filter((p) => re.test(p))
      .sort();
    cache.set(
      key,
      Promise.all(paths.map((p) => loaders[p]())).then((arrs) => arrs.flat().map((x) => applyDefaults(key, x as Record<string, unknown>))),
    );
  }
  return cache.get(key) as Promise<BankTypes[K][]>;
}

/** Aplica valores por defecto del esquema que el JSON puede omitir. */
function applyDefaults(key: BankKey, x: Record<string, unknown>) {
  if (key === 'toefl.build') return { prefix: '', suffix: '', distractors: [], ...x };
  if (key === 'ielts.p2') return { followUps: [], ...x };
  return x;
}

export function useBank<K extends BankKey>(key: K | null): { data: BankTypes[K][] | null; loading: boolean } {
  const [data, setData] = useState<BankTypes[K][] | null>(null);
  useEffect(() => {
    let alive = true;
    if (!key) return;
    setData(null);
    loadBank(key).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [key]);
  return { data, loading: key !== null && data === null };
}

/** Varios bancos a la vez. */
export function useBanks<K extends BankKey>(keys: K[]): Partial<{ [P in K]: BankTypes[P][] }> | null {
  const [data, setData] = useState<Partial<{ [P in K]: BankTypes[P][] }> | null>(null);
  const sig = keys.join('|');
  useEffect(() => {
    let alive = true;
    Promise.all(keys.map((k) => loadBank(k).then((d) => [k, d] as const))).then((pairs) => alive && setData(Object.fromEntries(pairs) as never));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return data;
}

/** Conjunto de lemas de la AWL (para el analizador léxico). */
let awlSet: Promise<Set<string>> | null = null;
export function loadAwlSet(): Promise<Set<string>> {
  if (!awlSet)
    awlSet = loadBank('study.decks').then((decks) => {
      const s = new Set<string>();
      for (const d of decks)
        if (d.category === 'awl')
          for (const c of d.cards) {
            s.add(c.term.toLowerCase());
            for (const f of c.family ?? []) s.add(f.toLowerCase());
          }
      return s;
    });
  return awlSet;
}

/** Metadatos de cada banco para la UI de práctica. */
export interface BankMeta {
  key: BankKey;
  exam: 'toefl' | 'ielts';
  section: 'reading' | 'listening' | 'writing' | 'speaking';
  title: string;
  es: string;
  en: string;
  minutes: number;
  lesson?: string;
}

export const BANK_META: BankMeta[] = [
  { key: 'toefl.ctw', exam: 'toefl', section: 'reading', title: 'Complete the Words', es: 'Completa las letras que faltan en un párrafo académico.', en: 'Fill in the missing letters in an academic paragraph.', minutes: 3, lesson: 'toefl-reading-ctw' },
  { key: 'toefl.daily', exam: 'toefl', section: 'reading', title: 'Read in Daily Life', es: 'Emails, avisos, anuncios y webs cortas.', en: 'Short emails, notices, ads and web pages.', minutes: 3, lesson: 'toefl-reading-daily' },
  { key: 'toefl.passage', exam: 'toefl', section: 'reading', title: 'Read an Academic Passage', es: 'Texto académico breve con 5 preguntas.', en: 'Short academic text with 5 questions.', minutes: 7, lesson: 'toefl-reading-academic' },
  { key: 'toefl.response', exam: 'toefl', section: 'listening', title: 'Listen and Choose a Response', es: 'Oyes una frase y eliges la respuesta natural.', en: 'Hear one line, choose the natural reply.', minutes: 1, lesson: 'toefl-listening-response' },
  { key: 'toefl.conversation', exam: 'toefl', section: 'listening', title: 'Listen to a Conversation', es: 'Conversación breve de la vida diaria o del campus.', en: 'Short everyday or campus conversation.', minutes: 2, lesson: 'toefl-listening-conversation' },
  { key: 'toefl.announcement', exam: 'toefl', section: 'listening', title: 'Listen to an Announcement', es: 'Aviso de clase o del campus.', en: 'Class or campus announcement.', minutes: 2, lesson: 'toefl-listening-announcement' },
  { key: 'toefl.talk', exam: 'toefl', section: 'listening', title: 'Listen to an Academic Talk', es: 'Mini clase académica con 4 preguntas.', en: 'Short lecture with 4 questions.', minutes: 4, lesson: 'toefl-listening-academic' },
  { key: 'toefl.build', exam: 'toefl', section: 'writing', title: 'Build a Sentence', es: 'Ordena los fragmentos para formar la respuesta.', en: 'Order the chunks to build the reply.', minutes: 1, lesson: 'toefl-writing-build' },
  { key: 'toefl.email', exam: 'toefl', section: 'writing', title: 'Write an Email', es: 'Email con 3 puntos en ~7 minutos.', en: 'An email covering 3 points in ~7 minutes.', minutes: 7, lesson: 'toefl-writing-email' },
  { key: 'toefl.discussion', exam: 'toefl', section: 'writing', title: 'Write for an Academic Discussion', es: 'Aporta tu opinión a un foro de clase (≥100 palabras, 10 min).', en: 'Post your view on a class forum (≥100 words, 10 min).', minutes: 10, lesson: 'toefl-writing-discussion' },
  { key: 'toefl.repeat', exam: 'toefl', section: 'speaking', title: 'Listen and Repeat', es: 'Repite 7 frases tras oírlas una vez.', en: 'Repeat 7 sentences after hearing them once.', minutes: 3, lesson: 'toefl-speaking-repeat' },
  { key: 'toefl.interview', exam: 'toefl', section: 'speaking', title: 'Take an Interview', es: '4 preguntas, ~45 s por respuesta, sin preparación.', en: '4 questions, ~45 s each, no prep time.', minutes: 5, lesson: 'toefl-speaking-interview' },
  { key: 'ielts.listening', exam: 'ielts', section: 'listening', title: 'Listening — Parts 1–4', es: 'Partes completas de 10 preguntas, una sola escucha.', en: 'Full 10-question parts, heard once.', minutes: 8, lesson: 'ielts-listening-overview' },
  { key: 'ielts.reading', exam: 'ielts', section: 'reading', title: 'Academic Reading passages', es: 'Textos de 700–900 palabras con 13–14 preguntas.', en: '700–900-word texts with 13–14 questions.', minutes: 20, lesson: 'ielts-reading-overview' },
  { key: 'ielts.task1', exam: 'ielts', section: 'writing', title: 'Writing Task 1', es: 'Describe un gráfico, tabla, mapa o proceso (≥150 palabras).', en: 'Describe a chart, table, map or process (≥150 words).', minutes: 20, lesson: 'ielts-writing-task1-overview' },
  { key: 'ielts.task2', exam: 'ielts', section: 'writing', title: 'Writing Task 2', es: 'Ensayo argumentativo (≥250 palabras).', en: 'Argumentative essay (≥250 words).', minutes: 40, lesson: 'ielts-writing-task2-overview' },
  { key: 'ielts.p1', exam: 'ielts', section: 'speaking', title: 'Speaking Part 1', es: 'Preguntas sobre temas cotidianos.', en: 'Questions on familiar topics.', minutes: 4, lesson: 'ielts-speaking-part1' },
  { key: 'ielts.p2', exam: 'ielts', section: 'speaking', title: 'Speaking Part 2', es: 'Cue card: 1 min de preparación y 2 min hablando.', en: 'Cue card: 1 min prep, 2 min talk.', minutes: 4, lesson: 'ielts-speaking-part2' },
  { key: 'ielts.p3', exam: 'ielts', section: 'speaking', title: 'Speaking Part 3', es: 'Discusión abstracta.', en: 'Abstract discussion.', minutes: 5, lesson: 'ielts-speaking-part3' },
];

export const bankMeta = (key: string) => BANK_META.find((b) => b.key === key);
