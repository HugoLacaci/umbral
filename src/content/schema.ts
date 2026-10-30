/**
 * Esquemas Zod de TODO el contenido de Umbral.
 * El contenido vive en JSON bajo src/content/** y se valida con `npm run test:content`.
 * Documentación humana: docs/CONTENIDO.md
 */
import { z } from 'zod';

/* ───────────────────────── Comunes ───────────────────────── */

export const Difficulty = z.enum(['easy', 'medium', 'hard']);
export const Usage = z.enum(['practice', 'mock']);
/** Nº de simulacro (1, 2, 3…): se pueden añadir tantos como se quiera. */
export const MockNo = z.number().int().min(1).max(20);
export const Module = z.enum(['router', 'lower', 'upper']);

/** Acentos disponibles para TTS. en-NZ cae a en-AU si el navegador no tiene voz NZ. */
export const Accent = z.enum(['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-NZ']);

export const Speaker = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  gender: z.enum(['f', 'm']),
  accent: Accent,
});

/** Una línea del guion: s = id del speaker, t = texto que se lee. */
export const Line = z.object({ s: z.string(), t: z.string().min(1) });

export const Audio = z.object({
  speakers: z.array(Speaker).min(1),
  lines: z.array(Line).min(1),
});

/** Campos comunes a todo "set" de examen (texto, audio o tarea). */
const setBase = {
  id: z.string().regex(/^[a-z0-9-]+$/, 'ids en kebab-case'),
  difficulty: Difficulty,
  usage: Usage,
  /** Sólo si usage = mock */
  mock: MockNo.optional(),
};

/* ───────────────────────── Ítems (preguntas) ───────────────────────── */

const itemBase = {
  id: z.string(),
  /** Tipo de pregunta fino para estadísticas de puntos débiles (ver QTYPES abajo). */
  qtype: z.string(),
  /** Por qué la respuesta correcta lo es (y, si procede, por qué no las demás). Inglés o español. */
  explanation: z.string().min(10),
  /** Cita LITERAL del texto o del guion que justifica la respuesta (se resalta en la corrección). */
  evidence: z.string().optional(),
};

export const McqItem = z.object({
  ...itemBase,
  kind: z.literal('mcq'),
  prompt: z.string(),
  options: z.array(z.string()).min(3).max(5),
  answer: z.number().int().min(0),
  /** Una nota por opción explicando por qué es (in)correcta. Opcional pero muy recomendable. */
  optionNotes: z.array(z.string()).optional(),
});

export const MultiItem = z.object({
  ...itemBase,
  kind: z.literal('multi'),
  prompt: z.string(),
  options: z.array(z.string()).min(4).max(7),
  answers: z.array(z.number().int().min(0)).min(2),
  optionNotes: z.array(z.string()).optional(),
});

export const JudgeItem = z.object({
  ...itemBase,
  kind: z.literal('judge'),
  statement: z.string(),
  scale: z.enum(['tfng', 'ynng']),
  answer: z.enum(['TRUE', 'FALSE', 'NOT GIVEN', 'YES', 'NO']),
});

export const GapItem = z.object({
  ...itemBase,
  kind: z.literal('gap'),
  /** Frase con "___" donde va el hueco. Puede omitirse si el hueco está en group.template. */
  prompt: z.string().optional(),
  /** Respuestas aceptadas; la primera es la canónica. Incluye variantes UK/US y numéricas ("3", "three"). */
  answers: z.array(z.string()).min(1),
  /** Límite de palabras de la instrucción (p. ej. NO MORE THAN TWO WORDS → 2). */
  maxWords: z.number().int().min(1).max(5),
  /** "AND/OR A NUMBER" */
  allowNumber: z.boolean().default(false),
});

export const MatchItem = z.object({
  ...itemBase,
  kind: z.literal('match'),
  prompt: z.string(),
  /** Clave de group.options (p. ej. "iv", "C"). */
  answer: z.string(),
});

export const Item = z.discriminatedUnion('kind', [McqItem, MultiItem, JudgeItem, GapItem, MatchItem]);

/** Diagrama sencillo para planos/mapas/diagramas a etiquetar (coordenadas en un lienzo width×height). */
export const DiagramShape = z.object({
  kind: z.enum(['building', 'room', 'road', 'path', 'water', 'park', 'trees', 'parking', 'field', 'arrow', 'label']),
  x: z.number(),
  y: z.number(),
  w: z.number().default(0),
  h: z.number().default(0),
  label: z.string().optional(),
});
export const Diagram = z.object({
  width: z.number(),
  height: z.number(),
  shapes: z.array(DiagramShape),
  /** Marcadores donde va cada respuesta: key = letra mostrada o id de ítem. */
  markers: z.array(z.object({ key: z.string(), x: z.number(), y: z.number() })).default([]),
  compass: z.boolean().default(true),
});

export const Group = z.object({
  id: z.string(),
  qtype: z.string(),
  /** Instrucción literal estilo examen ("Questions 1–5. Complete the notes below. Write NO MORE THAN TWO WORDS..."). */
  instructions: z.string(),
  /** Título de la tabla/formulario/notas, si lo hay. */
  title: z.string().optional(),
  /** Opciones compartidas para emparejar (encabezados i–x, personas A–E, finales de frase...). */
  options: z.array(z.object({ key: z.string(), text: z.string() })).optional(),
  /**
   * Plantilla con huecos para notas/formularios/tablas/resúmenes/flujo.
   * Usa {{itemId}} donde va cada hueco. Líneas separadas con \n. Tablas con sintaxis markdown | a | b |.
   */
  template: z.string().optional(),
  diagram: Diagram.optional(),
  items: z.array(Item).min(1),
});

/* ───────────────────────── TOEFL iBT 2026 ───────────────────────── */

const toeflSet = { ...setBase, module: Module.optional() };

/**
 * Complete the Words: párrafo académico (~70–100 palabras). La primera frase va completa;
 * después, 10 palabras con la segunda mitad borrada. Formato de cada hueco: [[palabraCompleta|prefijoVisible]].
 * Ej: "Bees [[communicate|commun]] through ..." → el alumno ve "commun____" y escribe "icate".
 */
export const ToeflCtwSet = z.object({
  ...toeflSet,
  task: z.literal('complete-words'),
  title: z.string(),
  text: z.string(),
  explanation: z.string().optional(),
});

export const ToeflReadingSet = z.object({
  ...toeflSet,
  task: z.enum(['daily-life', 'academic-passage']),
  title: z.string(),
  /** Para daily-life: email | notice | ad | webpage | schedule | text-messages | menu | social-post | form | sign */
  format: z.string().optional(),
  /** Párrafos separados con \n\n. En daily-life puede incluir cabeceras ("From: ...", "Subject: ..."). */
  text: z.string(),
  questions: z.array(McqItem).min(1),
});

export const ToeflListeningSet = z.object({
  ...toeflSet,
  task: z.enum(['choose-response', 'conversation', 'announcement', 'academic-talk']),
  title: z.string(),
  /** Frase introductoria que se muestra/lee antes ("Listen to a conversation between..."). */
  context: z.string().optional(),
  audio: Audio,
  questions: z.array(McqItem).min(1),
});

/** Build a Sentence: ordenar fragmentos para formar la respuesta de la persona B. */
export const ToeflBuildItem = z.object({
  ...setBase,
  /** Lo que dice la persona A (contexto). */
  context: z.object({ name: z.string(), text: z.string() }),
  respondent: z.string(),
  /** Palabras fijas antes/después de los huecos. */
  prefix: z.string().default(''),
  suffix: z.string().default(''),
  /** Fragmentos en el ORDEN CORRECTO (la app los baraja). 4–8 fragmentos. */
  answer: z.array(z.string()).min(3).max(9),
  /** Fragmento(s) que sobran (0–1 normalmente). */
  distractors: z.array(z.string()).default([]),
  explanation: z.string(),
});

export const Model = z.object({
  /** TOEFL (escala de tarea 0–5): '5' | '4' | '3'…; IELTS (bandas): '9' | '8' | '7' | '6' | '5'. */
  level: z.string(),
  text: z.string(),
  /** Comentario (en español) de por qué saca esa nota. */
  commentary: z.string(),
});

export const ToeflEmailTask = z.object({
  ...setBase,
  scenario: z.string(),
  to: z.string(),
  subject: z.string().optional(),
  /** Las 3 cosas que hay que hacer en el email. */
  tasks: z.array(z.string()).min(2).max(4),
  models: z.array(Model).min(1),
});

export const ToeflDiscussionTask = z.object({
  ...setBase,
  course: z.string(),
  professor: z.object({ name: z.string(), post: z.string() }),
  students: z.array(z.object({ name: z.string(), post: z.string() })).length(2),
  models: z.array(Model).min(1),
});

export const ToeflRepeatSet = z.object({
  ...setBase,
  /** Escenario ("You are learning to give tours of the campus museum..."). */
  context: z.string(),
  /** Descripción de la imagen de apoyo que verías en pantalla. */
  visual: z.string(),
  speaker: Speaker,
  /** 7 frases de longitud creciente (≈4 → 18 palabras). */
  sentences: z.array(z.string()).length(7),
});

export const ToeflInterviewSet = z.object({
  ...setBase,
  topic: z.string(),
  /** Presentación del entrevistador (se lee antes de la 1ª pregunta). */
  intro: z.string(),
  interviewer: Speaker,
  questions: z.array(z.string()).length(4),
  /** Una respuesta modelo (≈45 s, 90–120 palabras) por pregunta. */
  sampleAnswers: z.array(z.string()).length(4),
});

/* ───────────────────────── IELTS Academic ───────────────────────── */

export const IeltsReadingPassage = z.object({
  ...setBase,
  /** Nº de texto en el simulacro (1, 2, 3) o dificultad equivalente en práctica. */
  passageNo: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string(),
  subtitle: z.string().optional(),
  /** label = letra de párrafo (A, B, C...) cuando hay preguntas de matching. */
  paragraphs: z.array(z.object({ label: z.string().optional(), text: z.string() })).min(4),
  groups: z.array(Group).min(2),
});

export const IeltsListeningPart = z.object({
  ...setBase,
  part: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  title: z.string(),
  context: z.string(),
  audio: Audio,
  groups: z.array(Group).min(1),
});

const Series = z.object({ name: z.string(), values: z.array(z.number()) });
const VisualBase = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('line'),
    title: z.string(),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
    unit: z.string().optional(),
    categories: z.array(z.string()),
    series: z.array(Series).min(1),
  }),
  z.object({
    type: z.literal('bar'),
    title: z.string(),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
    unit: z.string().optional(),
    horizontal: z.boolean().default(false),
    categories: z.array(z.string()),
    series: z.array(Series).min(1),
  }),
  z.object({
    type: z.literal('pie'),
    title: z.string(),
    unit: z.string().default('%'),
    pies: z.array(z.object({ title: z.string(), slices: z.array(z.object({ label: z.string(), value: z.number() })) })).min(1),
  }),
  z.object({
    type: z.literal('table'),
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number()]))),
  }),
  z.object({
    type: z.literal('process'),
    title: z.string(),
    cyclic: z.boolean().default(false),
    steps: z.array(z.object({ label: z.string(), detail: z.string().optional() })).min(4),
  }),
  z.object({
    type: z.literal('map'),
    title: z.string(),
    maps: z.array(z.object({ title: z.string(), diagram: Diagram })).min(1),
  }),
]);
export const Visual = z.union([
  VisualBase,
  z.object({ type: z.literal('mixed'), title: z.string(), visuals: z.array(VisualBase).min(2) }),
]);

export const IeltsTask1 = z.object({
  ...setBase,
  chartType: z.enum(['line', 'bar', 'pie', 'table', 'map', 'process', 'mixed']),
  prompt: z.string(),
  visual: Visual,
  /** Rasgos clave que debe mencionar el overview / el informe. */
  keyFeatures: z.array(z.string()).min(2),
  models: z.array(Model).min(1),
});

export const EssayType = z.enum([
  'opinion',
  'discussion',
  'adv-disadv',
  'problem-solution',
  'cause-effect',
  'two-part',
  'positive-negative',
]);

export const IeltsTask2 = z.object({
  ...setBase,
  essayType: EssayType,
  prompt: z.string(),
  /** Partes del enunciado que hay que cubrir (checklist de Task Response). */
  checklist: z.array(z.string()).min(1),
  ideas: z.object({ for: z.array(z.string()), against: z.array(z.string()) }).optional(),
  models: z.array(Model).min(1),
});

export const IeltsSpeakingP1 = z.object({
  ...setBase,
  topic: z.string(),
  questions: z.array(z.string()).min(3).max(6),
  sampleAnswers: z.array(z.string()).optional(),
});
export const IeltsSpeakingP2 = z.object({
  ...setBase,
  topic: z.string(),
  /** "Describe a place you visited that..." */
  cue: z.string(),
  bullets: z.array(z.string()).min(3).max(4),
  /** "and explain why..." */
  closing: z.string(),
  followUps: z.array(z.string()).default([]),
  sampleAnswer: z.string(),
});
export const IeltsSpeakingP3 = z.object({
  ...setBase,
  topic: z.string(),
  /** id del cue card (P2) con el que enlaza temáticamente. */
  linkedP2: z.string().optional(),
  questions: z.array(z.string()).min(3).max(7),
  sampleAnswers: z.array(z.string()).optional(),
});

/* ───────────────────────── Study Room ───────────────────────── */

export const Card = z.object({
  id: z.string(),
  term: z.string(),
  pos: z.string().optional(),
  definition: z.string(),
  /** Traducción / equivalente en español. */
  es: z.string().optional(),
  example: z.string(),
  collocations: z.array(z.string()).optional(),
  /** Familia de palabras (AWL). */
  family: z.array(z.string()).optional(),
  register: z.enum(['formal', 'neutral', 'informal']).optional(),
  note: z.string().optional(),
  /** Aviso: suena forzado, falso amigo, error típico... */
  warning: z.string().optional(),
});

export const Deck = z.object({
  id: z.string(),
  category: z.enum(['awl', 'topic', 'graph', 'phrasal', 'idiom', 'campus', 'false-friend', 'collocation', 'preposition']),
  title: z.string(),
  titleEs: z.string(),
  description: z.string(),
  /** Sólo AWL */
  sublist: z.number().int().min(1).max(10).optional(),
  cards: z.array(Card).min(1),
});

export const DrillItem = z.object({
  id: z.string(),
  type: z.enum(['gap', 'transform', 'error', 'collocation', 'mcq']),
  /** gap: frase con ___ ; transform: frase original + "→" instrucción ; error: frase con error a corregir. */
  prompt: z.string(),
  options: z.array(z.string()).optional(),
  /** Respuestas aceptadas (texto). Para mcq: el texto exacto de la opción correcta. */
  answers: z.array(z.string()).min(1),
  explanation: z.string(),
  tags: z.array(z.string()).default([]),
  level: z.enum(['B1', 'B2', 'C1']).default('B2'),
});

export const GrammarTopic = z.object({
  id: z.string(),
  title: z.string(),
  titleEs: z.string(),
  level: z.enum(['B1', 'B2', 'C1']),
  /** Por qué sube nota (es). */
  why: z.string(),
  /** Explicación en markdown (es). */
  explanation: z.string(),
  examples: z.array(z.object({ en: z.string(), note: z.string().optional() })).min(3),
  mistakes: z.array(z.object({ wrong: z.string(), right: z.string(), why: z.string() })).min(2),
  exercises: z.array(DrillItem).min(5),
});

export const ConnectorGroup = z.object({
  id: z.string(),
  function: z.enum(['addition', 'contrast', 'cause', 'consequence', 'example', 'sequence', 'conclusion', 'concession', 'emphasis', 'clarification']),
  title: z.string(),
  titleEs: z.string(),
  items: z.array(
    z.object({
      phrase: z.string(),
      register: z.enum(['formal', 'neutral', 'informal']),
      /** Cómo se usa: "+ noun", "+ clause", "Sentence. X, clause." */
      pattern: z.string(),
      example: z.string(),
      warning: z.string().optional(),
    }),
  ),
});

export const Lesson = z.object({
  id: z.string(),
  exam: z.enum(['toefl', 'ielts', 'both']),
  section: z.enum(['reading', 'listening', 'writing', 'speaking', 'general']),
  /** Id del tipo de tarea/pregunta (para enlazar desde recomendaciones). */
  task: z.string().optional(),
  title: z.string(),
  summary: z.string(),
  minutes: z.number().int().min(1),
  /** Markdown en español. Secciones sugeridas: Qué piden · Trampas · Estrategia · Tiempo · Ejemplo resuelto. */
  body: z.string(),
  tags: z.array(z.string()).default([]),
});

export const Video = z.object({
  /** ID de YouTube (11 caracteres). */
  id: z.string().length(11),
  title: z.string(),
  channel: z.string(),
  exam: z.enum(['toefl', 'ielts', 'both']),
  section: z.enum(['overview', 'reading', 'listening', 'writing', 'speaking', 'vocabulary', 'grammar']),
  task: z.string().optional(),
  /** Para TOEFL: '2026' = formato nuevo; 'legacy' = formato anterior (se marca). */
  format: z.enum(['2026', 'legacy', 'n/a']),
  note: z.string().optional(),
  /** Fecha de verificación (YYYY-MM-DD) del oEmbed de YouTube. */
  verified: z.string(),
});

export const Resource = z.object({
  title: z.string(),
  url: z.string().url(),
  exam: z.enum(['toefl', 'ielts', 'both']),
  provider: z.string(),
  description: z.string(),
});

/* ───────────────────────── Tipos inferidos ───────────────────────── */

export type Difficulty = z.infer<typeof Difficulty>;
export type Accent = z.infer<typeof Accent>;
export type Speaker = z.infer<typeof Speaker>;
export type Audio = z.infer<typeof Audio>;
export type McqItem = z.infer<typeof McqItem>;
export type MultiItem = z.infer<typeof MultiItem>;
export type JudgeItem = z.infer<typeof JudgeItem>;
export type GapItem = z.infer<typeof GapItem>;
export type MatchItem = z.infer<typeof MatchItem>;
export type Item = z.infer<typeof Item>;
export type Group = z.infer<typeof Group>;
export type Diagram = z.infer<typeof Diagram>;
export type ToeflCtwSet = z.infer<typeof ToeflCtwSet>;
export type ToeflReadingSet = z.infer<typeof ToeflReadingSet>;
export type ToeflListeningSet = z.infer<typeof ToeflListeningSet>;
export type ToeflBuildItem = z.infer<typeof ToeflBuildItem>;
export type ToeflEmailTask = z.infer<typeof ToeflEmailTask>;
export type ToeflDiscussionTask = z.infer<typeof ToeflDiscussionTask>;
export type ToeflRepeatSet = z.infer<typeof ToeflRepeatSet>;
export type ToeflInterviewSet = z.infer<typeof ToeflInterviewSet>;
export type IeltsReadingPassage = z.infer<typeof IeltsReadingPassage>;
export type IeltsListeningPart = z.infer<typeof IeltsListeningPart>;
export type Visual = z.infer<typeof Visual>;
export type IeltsTask1 = z.infer<typeof IeltsTask1>;
export type IeltsTask2 = z.infer<typeof IeltsTask2>;
export type EssayType = z.infer<typeof EssayType>;
export type IeltsSpeakingP1 = z.infer<typeof IeltsSpeakingP1>;
export type IeltsSpeakingP2 = z.infer<typeof IeltsSpeakingP2>;
export type IeltsSpeakingP3 = z.infer<typeof IeltsSpeakingP3>;
export type Model = z.infer<typeof Model>;
export type Card = z.infer<typeof Card>;
export type Deck = z.infer<typeof Deck>;
export type DrillItem = z.infer<typeof DrillItem>;
export type GrammarTopic = z.infer<typeof GrammarTopic>;
export type ConnectorGroup = z.infer<typeof ConnectorGroup>;
export type Lesson = z.infer<typeof Lesson>;
export type Video = z.infer<typeof Video>;
export type Resource = z.infer<typeof Resource>;

/* ───────────────────────── Bancos (un JSON = un array de uno de estos) ───────────────────────── */

/**
 * Cada archivo JSON se asigna a un banco según su carpeta. Clave → [glob relativo a src/content, esquema].
 * Un archivo = un array JSON. Puedes partir un banco en varios archivos (p. ej. academic-passage-1.json, -2.json).
 */
export const BANKS = {
  'toefl.ctw': ['toefl/reading/complete-words*.json', ToeflCtwSet],
  'toefl.daily': ['toefl/reading/daily-life*.json', ToeflReadingSet],
  'toefl.passage': ['toefl/reading/academic-passage*.json', ToeflReadingSet],
  'toefl.response': ['toefl/listening/choose-response*.json', ToeflListeningSet],
  'toefl.conversation': ['toefl/listening/conversation*.json', ToeflListeningSet],
  'toefl.announcement': ['toefl/listening/announcement*.json', ToeflListeningSet],
  'toefl.talk': ['toefl/listening/academic-talk*.json', ToeflListeningSet],
  'toefl.build': ['toefl/writing/build-sentence*.json', ToeflBuildItem],
  'toefl.email': ['toefl/writing/email*.json', ToeflEmailTask],
  'toefl.discussion': ['toefl/writing/academic-discussion*.json', ToeflDiscussionTask],
  'toefl.repeat': ['toefl/speaking/listen-repeat*.json', ToeflRepeatSet],
  'toefl.interview': ['toefl/speaking/interview*.json', ToeflInterviewSet],
  'ielts.reading': ['ielts/reading/*.json', IeltsReadingPassage],
  'ielts.listening': ['ielts/listening/*.json', IeltsListeningPart],
  'ielts.task1': ['ielts/writing/task1*.json', IeltsTask1],
  'ielts.task2': ['ielts/writing/task2*.json', IeltsTask2],
  'ielts.p1': ['ielts/speaking/part1*.json', IeltsSpeakingP1],
  'ielts.p2': ['ielts/speaking/part2*.json', IeltsSpeakingP2],
  'ielts.p3': ['ielts/speaking/part3*.json', IeltsSpeakingP3],
  'study.decks': ['study/vocab/*.json', Deck],
  'study.grammar': ['study/grammar/grammar*.json', GrammarTopic],
  'study.drills': ['study/grammar/drills*.json', DrillItem],
  'study.connectors': ['study/grammar/connectors*.json', ConnectorGroup],
  'study.lessons': ['study/lessons/*.json', Lesson],
  'study.videos': ['study/videos*.json', Video],
  'study.resources': ['study/resources*.json', Resource],
} as const;

export type BankKey = keyof typeof BANKS;

/** Tipos de pregunta canónicos (qtype) para estadísticas. Se pueden usar otros, pero estos tienen nombre bonito. */
export const QTYPES: Record<string, { es: string; en: string; lesson?: string }> = {
  // TOEFL reading
  ctw: { es: 'Complete the Words', en: 'Complete the Words', lesson: 'toefl-reading-ctw' },
  'dl-purpose': { es: 'Daily Life · propósito', en: 'Daily Life · purpose', lesson: 'toefl-reading-daily' },
  'dl-detail': { es: 'Daily Life · detalle', en: 'Daily Life · detail', lesson: 'toefl-reading-daily' },
  'dl-inference': { es: 'Daily Life · inferencia', en: 'Daily Life · inference', lesson: 'toefl-reading-daily' },
  'ap-main-idea': { es: 'Pasaje · idea principal', en: 'Passage · main idea', lesson: 'toefl-reading-academic' },
  'ap-detail': { es: 'Pasaje · detalle', en: 'Passage · detail', lesson: 'toefl-reading-academic' },
  'ap-vocab': { es: 'Pasaje · vocabulario', en: 'Passage · vocabulary', lesson: 'toefl-reading-academic' },
  'ap-inference': { es: 'Pasaje · inferencia', en: 'Passage · inference', lesson: 'toefl-reading-academic' },
  'ap-purpose': { es: 'Pasaje · propósito retórico', en: 'Passage · rhetorical purpose', lesson: 'toefl-reading-academic' },
  'ap-reference': { es: 'Pasaje · referencia', en: 'Passage · reference', lesson: 'toefl-reading-academic' },
  // TOEFL listening
  'cr-response': { es: 'Elegir respuesta', en: 'Choose a Response', lesson: 'toefl-listening-response' },
  'ls-gist': { es: 'Escucha · idea general', en: 'Listening · gist', lesson: 'toefl-listening-academic' },
  'ls-detail': { es: 'Escucha · detalle', en: 'Listening · detail', lesson: 'toefl-listening-academic' },
  'ls-inference': { es: 'Escucha · inferencia', en: 'Listening · inference', lesson: 'toefl-listening-academic' },
  'ls-purpose': { es: 'Escucha · propósito/función', en: 'Listening · purpose', lesson: 'toefl-listening-conversation' },
  'ls-attitude': { es: 'Escucha · actitud', en: 'Listening · attitude', lesson: 'toefl-listening-conversation' },
  'ls-next': { es: 'Escucha · qué pasará después', en: 'Listening · prediction', lesson: 'toefl-listening-announcement' },
  build: { es: 'Build a Sentence', en: 'Build a Sentence', lesson: 'toefl-writing-build' },
  // IELTS
  mcq: { es: 'Tipo test', en: 'Multiple choice', lesson: 'ielts-reading-mcq' },
  multi: { es: 'Tipo test (varias)', en: 'Multiple choice (choose two)', lesson: 'ielts-reading-mcq' },
  tfng: { es: 'True / False / Not Given', en: 'True / False / Not Given', lesson: 'ielts-reading-tfng' },
  ynng: { es: 'Yes / No / Not Given', en: 'Yes / No / Not Given', lesson: 'ielts-reading-tfng' },
  'matching-headings': { es: 'Emparejar encabezados', en: 'Matching headings', lesson: 'ielts-reading-headings' },
  'matching-info': { es: 'Emparejar información', en: 'Matching information', lesson: 'ielts-reading-matching' },
  'matching-features': { es: 'Emparejar rasgos', en: 'Matching features', lesson: 'ielts-reading-matching' },
  'matching-endings': { es: 'Emparejar finales de frase', en: 'Matching sentence endings', lesson: 'ielts-reading-matching' },
  'sentence-completion': { es: 'Completar frases', en: 'Sentence completion', lesson: 'ielts-reading-completion' },
  'summary-completion': { es: 'Completar resumen', en: 'Summary completion', lesson: 'ielts-reading-completion' },
  'note-completion': { es: 'Completar notas', en: 'Note completion', lesson: 'ielts-listening-completion' },
  'table-completion': { es: 'Completar tabla', en: 'Table completion', lesson: 'ielts-listening-completion' },
  'flowchart-completion': { es: 'Completar diagrama de flujo', en: 'Flow-chart completion', lesson: 'ielts-listening-completion' },
  'form-completion': { es: 'Completar formulario', en: 'Form completion', lesson: 'ielts-listening-completion' },
  'diagram-label': { es: 'Etiquetar diagrama', en: 'Diagram labelling', lesson: 'ielts-reading-completion' },
  'map-labelling': { es: 'Etiquetar mapa/plano', en: 'Map/plan labelling', lesson: 'ielts-listening-maps' },
  'short-answer': { es: 'Respuesta corta', en: 'Short answer', lesson: 'ielts-reading-completion' },
  matching: { es: 'Emparejar', en: 'Matching', lesson: 'ielts-listening-matching' },
};
