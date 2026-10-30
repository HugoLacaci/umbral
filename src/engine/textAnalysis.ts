/**
 * Analizador propio de textos escritos (y transcripciones) — sin servidor.
 * Calcula métricas objetivas y, con ellas, una ESTIMACIÓN honesta por criterio de rúbrica.
 */

export const CONNECTORS: Record<string, string[]> = {
  addition: ['moreover', 'furthermore', 'in addition', 'additionally', 'also', 'besides', 'what is more', 'as well as', 'not only'],
  contrast: ['however', 'nevertheless', 'nonetheless', 'on the other hand', 'whereas', 'while', 'in contrast', 'by contrast', 'conversely', 'but', 'yet', 'on the contrary'],
  concession: ['although', 'even though', 'despite', 'in spite of', 'admittedly', 'granted', 'though', 'even if'],
  cause: ['because', 'since', 'as a result of', 'due to', 'owing to', 'because of', 'given that'],
  consequence: ['therefore', 'thus', 'consequently', 'as a result', 'hence', 'accordingly', 'so that', 'which means that', 'for this reason'],
  example: ['for example', 'for instance', 'such as', 'to illustrate', 'namely', 'in particular', 'a case in point'],
  sequence: ['firstly', 'first of all', 'secondly', 'finally', 'subsequently', 'then', 'afterwards', 'meanwhile', 'to begin with', 'lastly'],
  conclusion: ['in conclusion', 'to conclude', 'to sum up', 'overall', 'in summary', 'all in all', 'on balance', 'in short'],
  emphasis: ['indeed', 'in fact', 'clearly', 'notably', 'particularly', 'above all', 'undoubtedly'],
  clarification: ['in other words', 'that is to say', 'that is', 'to put it another way', 'specifically'],
};

const STOP = new Set(
  'a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those there their they them he she his her we our you your i me my not no do does did have has had will would can could should may might must so than then too very just also more most such into about over after before between through during which who whom whose what when where why how all any each other some many much both few own same only one two'.split(' '),
);

const INFORMAL = [
  'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'stuff', 'things like that', 'a lot of', 'lots of', 'kids', 'guys', 'okay', 'ok', 'cool', 'awesome', 'pretty much', 'super', 'tons of', 'nowadays people', 'etc',
];

const SUBORDINATORS = ['although', 'because', 'since', 'whereas', 'while', 'unless', 'if', 'when', 'which', 'who', 'whom', 'whose', 'that', 'where', 'even though', 'so that', 'provided that', 'as long as'];

export interface TextMetrics {
  words: number;
  sentences: number;
  paragraphs: number;
  avgSentenceLength: number;
  sentenceLengthSd: number;
  /** Type-token ratio bruto. */
  ttr: number;
  /** Moving-average TTR (ventana 50): no depende de la longitud. */
  mattr: number;
  /** % de palabras (de contenido) que pertenecen a la AWL. */
  awlPercent: number;
  awlWords: string[];
  connectors: { phrase: string; fn: string; count: number }[];
  connectorFunctions: number;
  /** Palabras de contenido repetidas en exceso. */
  repeated: { word: string; count: number }[];
  contractions: string[];
  informal: string[];
  subordinateRatio: number;
  passives: number;
  longWords: number;
  hasOverview: boolean;
  questionMarks: number;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? []).map((w) => w.replace(/’/g, "'"));
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => /[a-zA-Z]/.test(s));
}

function mattr(tokens: string[], w = 50): number {
  if (tokens.length === 0) return 0;
  if (tokens.length <= w) return new Set(tokens).size / tokens.length;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + w <= tokens.length; i++) {
    sum += new Set(tokens.slice(i, i + w)).size / w;
    n++;
  }
  return sum / n;
}

/** Lematización mínima para buscar en la AWL (analyses → analyse, studied → study…). */
function stems(w: string): string[] {
  const out = [w];
  const rules: [RegExp, string][] = [
    [/ies$/, 'y'], [/ied$/, 'y'], [/es$/, ''], [/s$/, ''], [/ed$/, ''], [/ed$/, 'e'], [/ing$/, ''], [/ing$/, 'e'], [/ly$/, ''], [/ally$/, ''], [/ation$/, 'e'], [/ations$/, 'e'],
  ];
  for (const [re, rep] of rules) if (re.test(w)) out.push(w.replace(re, rep));
  return out;
}

export function countPhrase(text: string, phrase: string): number {
  const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'gi');
  return (text.match(re) ?? []).length;
}

export function analyzeText(text: string, awl: Set<string> = new Set()): TextMetrics {
  const tokens = tokenize(text);
  const sentences = splitSentences(text);
  const paragraphs = text.split(/\n\s*\n|\n(?=\s*[A-Z])/).map((p) => p.trim()).filter((p) => p.split(/\s+/).length > 3).length;
  const lens = sentences.map((s) => tokenize(s).length);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const sd = lens.length ? Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length) : 0;

  const content = tokens.filter((t) => !STOP.has(t) && t.length > 2);
  const awlHits = content.filter((t) => stems(t).some((s) => awl.has(s)));

  const lower = text.toLowerCase();
  const connectors: TextMetrics['connectors'] = [];
  for (const [fn, list] of Object.entries(CONNECTORS)) {
    for (const phrase of list) {
      const c = countPhrase(lower, phrase);
      if (c) connectors.push({ phrase, fn, count: c });
    }
  }
  // "as a result of" contiene "as a result": evita doble conteo eliminando subfrases contenidas
  const dedup = connectors.filter((c) => !connectors.some((o) => o !== c && o.phrase.includes(c.phrase) && o.count >= c.count && o.phrase.length > c.phrase.length));

  const freq = new Map<string, number>();
  for (const t of content) freq.set(t, (freq.get(t) ?? 0) + 1);
  const threshold = Math.max(4, Math.round(tokens.length / 60));
  const repeated = [...freq.entries()].filter(([, c]) => c >= threshold).sort((a, b) => b[1] - a[1]).map(([word, count]) => ({ word, count }));

  // "it's", "don't", "we're"… (los posesivos tipo "student's" no cuentan)
  const contractions = tokens.filter((t) => /n't$|'re$|'ve$|'ll$|'m$|'d$/.test(t) || /^(it|that|there|what|he|she|who|let|here|where)'s$/.test(t));
  const informal = INFORMAL.filter((p) => countPhrase(lower, p) > 0);
  const subs = SUBORDINATORS.reduce((s, p) => s + countPhrase(lower, p), 0);
  const passives = (lower.match(/\b(is|are|was|were|be|been|being)\s+(\w+ly\s+)?\w+(ed|en|wn|lt|ught)\b/g) ?? []).length;

  return {
    words: tokens.length,
    sentences: sentences.length,
    paragraphs: Math.max(paragraphs, text.trim() ? 1 : 0),
    avgSentenceLength: round1(avg),
    sentenceLengthSd: round1(sd),
    ttr: tokens.length ? round2(new Set(tokens).size / tokens.length) : 0,
    mattr: round2(mattr(tokens)),
    awlPercent: content.length ? round1((awlHits.length / content.length) * 100) : 0,
    awlWords: [...new Set(awlHits)],
    connectors: dedup,
    connectorFunctions: new Set(dedup.map((c) => c.fn)).size,
    repeated,
    contractions: [...new Set(contractions)],
    informal,
    subordinateRatio: sentences.length ? round2(subs / sentences.length) : 0,
    passives,
    longWords: tokens.filter((t) => t.length >= 9).length,
    hasOverview: /\b(overall|in general|generally speaking|it is (clear|evident|noticeable)|the most (striking|noticeable)|in summary)\b/i.test(text),
    questionMarks: (text.match(/\?/g) ?? []).length,
  };
}

/* ───────────────────────── Estimaciones ───────────────────────── */

export interface LtCounts {
  grammar: number;
  spelling: number;
  style: number;
}

export interface CriterionEstimate {
  key: string;
  score: number;
  /** Explicaciones de lo que ha pesado en la nota. */
  notes: string[];
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const half = (x: number) => Math.round(x * 2) / 2;

/**
 * Estimación IELTS Writing por criterio (bandas 4–8.5: el análisis automático no puede justificar un 9).
 * checklist = proporción de partes del enunciado que el alumno marca como cubiertas (0–1).
 */
export function estimateIeltsWriting(
  m: TextMetrics,
  opts: { task: 1 | 2; lt?: LtCounts; checklist?: number },
): { criteria: CriterionEstimate[]; band: number } {
  const min = opts.task === 1 ? 150 : 250;
  const per100 = (n: number) => (m.words ? (n / m.words) * 100 : 0);
  const lt = opts.lt;

  // Task Achievement / Response
  const taNotes: string[] = [];
  let ta = 6.5;
  if (opts.checklist !== undefined) {
    ta = 5 + opts.checklist * 2.5;
    taNotes.push(`Cubres ${Math.round(opts.checklist * 100)} % de las partes del enunciado (según tu checklist).`);
  }
  if (opts.task === 1) {
    if (m.hasOverview) taNotes.push('Hay una frase de visión general (overview): imprescindible para pasar de 5.');
    else {
      ta = Math.min(ta, 5.5);
      taNotes.push('No detecto un overview ("Overall, …"). Sin él, Task Achievement suele quedarse en 5.');
    }
  } else if (m.paragraphs < 4) {
    ta -= 0.5;
    taNotes.push(`Sólo ${m.paragraphs} párrafo(s): un ensayo bien desarrollado suele tener 4–5.`);
  }
  if (m.words < min) {
    ta = Math.min(ta, m.words < min * 0.8 ? 5 : 5.5);
    taNotes.push(`${m.words}/${min} palabras: por debajo del mínimo es difícil demostrar un desarrollo suficiente (se limita la estimación).`);
  }

  // Coherence & Cohesion
  const ccNotes: string[] = [];
  let cc = 5 + Math.min(m.connectorFunctions, 6) * 0.35;
  const overused = m.connectors.filter((c) => c.count >= 3);
  if (overused.length) {
    cc -= 0.5;
    ccNotes.push(`Repites mucho: ${overused.map((c) => `"${c.phrase}" ×${c.count}`).join(', ')}. Varía o elimina conectores mecánicos.`);
  }
  if (m.paragraphs <= 1 && m.words > 80) {
    cc -= 1;
    ccNotes.push('Sin párrafos: la división en párrafos es parte del criterio.');
  }
  ccNotes.push(`${m.connectors.length} conectores distintos de ${m.connectorFunctions} funciones.`);

  // Lexical Resource
  const lrNotes: string[] = [];
  let lr = 4.5 + clamp((m.mattr - 0.6) * 10, 0, 3) + clamp(m.awlPercent / 6, 0, 1.2);
  if (lt?.spelling) {
    const sp = per100(lt.spelling);
    lr -= clamp(sp * 0.5, 0, 1.5);
    lrNotes.push(`${lt.spelling} posibles faltas de ortografía.`);
  }
  if (m.repeated.length) lrNotes.push(`Palabras repetidas: ${m.repeated.slice(0, 5).map((r) => `${r.word} ×${r.count}`).join(', ')}.`);
  if (m.informal.length) {
    lr -= 0.5;
    lrNotes.push(`Registro informal: ${m.informal.join(', ')}.`);
  }
  lrNotes.push(`Variedad léxica (MATTR) ${m.mattr} · AWL ${m.awlPercent} %.`);

  // Grammatical Range & Accuracy
  const graNotes: string[] = [];
  let gra = 5 + clamp(m.subordinateRatio, 0, 1.2) + clamp(m.sentenceLengthSd / 8, 0, 0.8) + (m.passives > 0 ? 0.3 : 0);
  if (lt) {
    const g = per100(lt.grammar);
    gra -= clamp(g * 0.6, 0, 2.5);
    graNotes.push(`${lt.grammar} posibles errores gramaticales (${g.toFixed(1)} por 100 palabras).`);
  } else graNotes.push('Sin corrección de LanguageTool: la precisión no se ha podido medir.');
  if (m.contractions.length) {
    graNotes.push(`Contracciones en un texto académico: ${m.contractions.slice(0, 5).join(', ')}.`);
    lr -= 0.25;
  }
  graNotes.push(`Frases de ${m.avgSentenceLength} palabras de media (±${m.sentenceLengthSd}).`);

  const criteria: CriterionEstimate[] = [
    { key: opts.task === 1 ? 'TA' : 'TR', score: half(clamp(ta, 4, 8.5)), notes: taNotes },
    { key: 'CC', score: half(clamp(cc, 4, 8.5)), notes: ccNotes },
    { key: 'LR', score: half(clamp(lr, 4, 8.5)), notes: lrNotes },
    { key: 'GRA', score: half(clamp(gra, 4, 8.5)), notes: graNotes },
  ];
  const avg = criteria.reduce((s, c) => s + c.score, 0) / 4;
  return { criteria, band: Math.floor(avg * 2 + 1e-9) / 2 };
}

/** Estimación TOEFL Email / Academic Discussion en la escala de tarea 0–5. */
export function estimateToeflWriting(
  m: TextMetrics,
  opts: { task: 'email' | 'discussion'; lt?: LtCounts; checklist?: number },
): { criteria: CriterionEstimate[]; score: number } {
  const target = opts.task === 'email' ? 100 : 100;
  const notes: string[] = [];
  let dev = opts.checklist !== undefined ? 2 + opts.checklist * 3 : 3.5;
  if (m.words < target) {
    dev = Math.min(dev, m.words < 60 ? 2 : 3);
    notes.push(`${m.words} palabras: ${opts.task === 'discussion' ? 'se recomienda ≥100' : 'un email completo suele tener 100–150'}.`);
  }
  const langNotes: string[] = [];
  let lang = 2 + clamp((m.mattr - 0.6) * 8, 0, 2) + clamp(m.subordinateRatio, 0, 1);
  if (opts.lt) {
    const per100 = m.words ? ((opts.lt.grammar + opts.lt.spelling) / m.words) * 100 : 0;
    lang -= clamp(per100 * 0.4, 0, 2);
    langNotes.push(`${opts.lt.grammar + opts.lt.spelling} posibles errores de gramática/ortografía.`);
  }
  const orgNotes: string[] = [];
  const org = 2.5 + Math.min(m.connectorFunctions, 5) * 0.4;
  orgNotes.push(`${m.connectorFunctions} funciones de conexión distintas.`);
  if (opts.task === 'discussion' && m.informal.length) langNotes.push(`Expresiones informales: ${m.informal.join(', ')}.`);
  const criteria: CriterionEstimate[] = [
    { key: 'TASK', score: clamp(Math.round(dev * 2) / 2, 0, 5), notes },
    { key: 'ORG', score: clamp(Math.round(org * 2) / 2, 0, 5), notes: orgNotes },
    { key: 'LANG', score: clamp(Math.round(lang * 2) / 2, 0, 5), notes: langNotes },
  ];
  const score = clamp(Math.round(criteria.reduce((s, c) => s + c.score, 0) / 3), 0, 5);
  return { criteria, score };
}

/** Comprueba saludo/despedida en emails. */
export function emailConventions(text: string) {
  return {
    greeting: /^\s*(dear|hi|hello|good (morning|afternoon))\b/i.test(text),
    closing: /(best (regards|wishes)|kind regards|sincerely|regards|thank you|thanks|cheers)[,!.]?\s*\n?\s*\w*\s*$/i.test(text.trim()) || /(best|kind) regards|sincerely|yours/i.test(text),
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
