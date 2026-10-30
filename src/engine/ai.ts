/**
 * Corrección externa gratuita:
 *  - LanguageTool (API pública): gramática y ortografía. Límites: ~20 peticiones/min por IP, 20 KB por texto.
 *  - Google Gemini (opcional, con la API key del propio usuario guardada sólo en su navegador).
 */

export interface LtMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: string[];
  category: string;
  issueType: string;
  rule: string;
}

let lastCall = 0;

export async function languageToolCheck(text: string, variant: 'en-GB' | 'en-US' = 'en-US'): Promise<LtMatch[]> {
  const wait = 3200 - (Date.now() - lastCall); // respetamos el límite público
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const body = new URLSearchParams({ text: text.slice(0, 18000), language: variant, enabledOnly: 'false' });
  const res = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (res.status === 429) throw new Error('LanguageTool: demasiadas peticiones; espera un minuto.');
  if (!res.ok) throw new Error(`LanguageTool: error ${res.status}`);
  const json = await res.json();
  return (json.matches ?? []).map((m: any) => ({
    message: m.message,
    shortMessage: m.shortMessage,
    offset: m.offset,
    length: m.length,
    replacements: (m.replacements ?? []).slice(0, 4).map((r: any) => r.value),
    category: m.rule?.category?.id ?? '',
    issueType: m.rule?.issueType ?? '',
    rule: m.rule?.id ?? '',
  }));
}

export function ltCounts(matches: LtMatch[]) {
  let grammar = 0;
  let spelling = 0;
  let style = 0;
  for (const m of matches) {
    if (m.issueType === 'misspelling' || m.category === 'TYPOS') spelling++;
    else if (['style', 'locale-violation', 'register', 'whitespace', 'typographical'].includes(m.issueType) || ['STYLE', 'REDUNDANCY', 'TYPOGRAPHY', 'CASING', 'PUNCTUATION'].includes(m.category)) style++;
    else grammar++;
  }
  return { grammar, spelling, style };
}

/* ─────────── Gemini ─────────── */

export interface AiFeedback {
  criteria: { name: string; score: number; comment: string }[];
  overall: number;
  strengths: string[];
  improvements: string[];
  corrections: { original: string; corrected: string; why: string }[];
  improvedVersion?: string;
}

const MODEL = 'gemini-2.5-flash';

export async function geminiEvaluate(apiKey: string, prompt: string): Promise<AiFeedback> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(res.status === 400 || res.status === 403 ? 'La API key de Gemini no es válida o no tiene permisos.' : res.status === 429 ? 'Has superado la cuota gratuita de Gemini; prueba más tarde.' : `Gemini: error ${res.status} ${t.slice(0, 120)}`);
  }
  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
  const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, ''));
  return parsed as AiFeedback;
}

export function buildWritingPrompt(opts: {
  exam: 'toefl' | 'ielts';
  task: string;
  prompt: string;
  answer: string;
  criteria: string[];
  scale: string;
  lang: 'es' | 'en';
}) {
  return `You are a strict, experienced ${opts.exam === 'toefl' ? 'TOEFL iBT (2026 format)' : 'IELTS Academic'} writing examiner.
Task type: ${opts.task}
Scale: ${opts.scale}
Criteria: ${opts.criteria.join(', ')}

TASK PROMPT:
"""${opts.prompt}"""

CANDIDATE RESPONSE (${opts.answer.trim().split(/\s+/).length} words):
"""${opts.answer}"""

Evaluate honestly using the public band descriptors / scoring rubric. Do not inflate scores.
Write all comments in ${opts.lang === 'es' ? 'Spanish' : 'English'} (quote the candidate's English when pointing at errors).
Return ONLY JSON with this exact shape:
{"criteria":[{"name":string,"score":number,"comment":string}],"overall":number,"strengths":[string],"improvements":[string],"corrections":[{"original":string,"corrected":string,"why":string}],"improvedVersion":string}
- "criteria": one entry per criterion listed above, in the same order.
- "overall": ${opts.exam === 'ielts' ? 'the task band (0–9, half bands)' : 'the task score (0–5, whole numbers)'}.
- "corrections": up to 8 most important errors.
- "improvedVersion": a corrected, improved version of the response at a slightly higher level, keeping the candidate's ideas.`;
}

export function buildSpeakingPrompt(opts: { exam: 'toefl' | 'ielts'; task: string; questions: string; transcript: string; metrics: string; lang: 'es' | 'en' }) {
  return `You are an experienced ${opts.exam === 'toefl' ? 'TOEFL iBT (2026) speaking rater' : 'IELTS speaking examiner'}.
Task: ${opts.task}
Questions: """${opts.questions}"""
Automatic speech-recognition TRANSCRIPT of the candidate (may contain recognition errors; punctuation is missing): """${opts.transcript}"""
Fluency metrics: ${opts.metrics}
You cannot hear pronunciation: say so and do not guess it beyond what the transcript suggests.
Write comments in ${opts.lang === 'es' ? 'Spanish' : 'English'}.
Return ONLY JSON: {"criteria":[{"name":string,"score":number,"comment":string}],"overall":number,"strengths":[string],"improvements":[string],"corrections":[{"original":string,"corrected":string,"why":string}],"improvedVersion":string}
Criteria: ${opts.exam === 'ielts' ? 'Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation (bands 0–9)' : 'Delivery, Language Use, Topic Development (0–5)'}. "overall": ${opts.exam === 'ielts' ? 'band 0–9' : 'score 0–5'}. "improvedVersion": a natural higher-level answer using the candidate's ideas.`;
}
