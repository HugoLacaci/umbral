import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Wand2, ListChecks, BookText, Gauge } from 'lucide-react';
import type { IeltsTask1, IeltsTask2, ToeflDiscussionTask, ToeflEmailTask, Model } from '@/content/schema';
import { Task1Visual } from '@/components/charts/Task1Visual';
import { Button, Card, Notice, Badge, Tabs, TabsList, TabsTrigger, TabsContent, SectionTitle } from '@/components/ui';
import { analyzeText, estimateIeltsWriting, estimateToeflWriting, emailConventions, type CriterionEstimate } from '@/engine/textAnalysis';
import { languageToolCheck, ltCounts, geminiEvaluate, buildWritingPrompt, type LtMatch, type AiFeedback } from '@/engine/ai';
import { loadAwlSet } from '@/content';
import { useApp } from '@/store';
import { useT } from '@/i18n';
import { cn, wordCount } from '@/lib/cn';

export type WritingKind = 'toefl.email' | 'toefl.discussion' | 'ielts.task1' | 'ielts.task2';
export type WritingTaskData = ToeflEmailTask | ToeflDiscussionTask | IeltsTask1 | IeltsTask2;

export const MIN_WORDS: Record<WritingKind, number> = { 'toefl.email': 0, 'toefl.discussion': 100, 'ielts.task1': 150, 'ielts.task2': 250 };
export const WRITING_MINUTES: Record<WritingKind, number> = { 'toefl.email': 7, 'toefl.discussion': 10, 'ielts.task1': 20, 'ielts.task2': 40 };

export function writingPromptText(kind: WritingKind, task: WritingTaskData): string {
  switch (kind) {
    case 'toefl.email': {
      const t = task as ToeflEmailTask;
      return `${t.scenario}\nWrite an email to ${t.to}. In your email, do the following:\n${t.tasks.map((x) => `- ${x}`).join('\n')}`;
    }
    case 'toefl.discussion': {
      const t = task as ToeflDiscussionTask;
      return `${t.course}\nProfessor ${t.professor.name}: ${t.professor.post}\n${t.students.map((s) => `${s.name}: ${s.post}`).join('\n')}`;
    }
    case 'ielts.task1':
      return (task as IeltsTask1).prompt;
    case 'ielts.task2':
      return (task as IeltsTask2).prompt;
  }
}

/* ─────────── Enunciado ─────────── */

export function WritingPrompt({ kind, task }: { kind: WritingKind; task: WritingTaskData }) {
  const t = useT();
  if (kind === 'toefl.email') {
    const e = task as ToeflEmailTask;
    return (
      <div className="space-y-3 text-[15px] leading-relaxed">
        <p className="text-[13px] font-semibold text-muted uppercase">Write an Email</p>
        <p>{e.scenario}</p>
        <p className="font-medium">
          Write an email to {e.to}. In your email, do the following:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {e.tasks.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">Write as much as you can and in complete sentences.</p>
        <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">
          <div>
            <span className="text-muted">To:</span> {e.to}
          </div>
          {e.subject && (
            <div>
              <span className="text-muted">Subject:</span> {e.subject}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (kind === 'toefl.discussion') {
    const d = task as ToeflDiscussionTask;
    return (
      <div className="space-y-4 text-[15px] leading-relaxed">
        <p className="text-[13px] font-semibold text-muted uppercase">Write for an Academic Discussion</p>
        <p className="text-sm text-muted">
          Your professor is teaching a class on {d.course}. Write a post responding to the professor’s question. In your response, you should express and support your opinion and make a contribution to the discussion in your own words. An effective response will contain at least 100 words.
        </p>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">{d.professor.name[0]}</span>
            <span className="font-semibold">{d.professor.name}</span>
            <Badge>{t('Profesor/a', 'Professor')}</Badge>
          </div>
          <p>{d.professor.post}</p>
        </div>
        {d.students.map((s) => (
          <div key={s.name} className="ml-4 rounded-2xl border border-line bg-surface-2 p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-xs font-bold">{s.name[0]}</span>
              <span className="font-semibold">{s.name}</span>
            </div>
            <p>{s.post}</p>
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'ielts.task1') {
    const x = task as IeltsTask1;
    return (
      <div className="space-y-3 text-[15px]">
        <p className="text-[13px] font-semibold text-muted uppercase">Writing Task 1 · {t('dedica unos 20 minutos', 'spend about 20 minutes')}</p>
        <p className="leading-relaxed whitespace-pre-line">{x.prompt}</p>
        <Task1Visual visual={x.visual} />
      </div>
    );
  }
  const x = task as IeltsTask2;
  return (
    <div className="space-y-3 text-[15px]">
      <p className="text-[13px] font-semibold text-muted uppercase">Writing Task 2 · {t('dedica unos 40 minutos', 'spend about 40 minutes')}</p>
      <div className="rounded-2xl border border-line bg-surface p-4 leading-relaxed whitespace-pre-line">{x.prompt}</div>
    </div>
  );
}

/* ─────────── Editor ─────────── */

export function WritingEditor({ kind, value, onChange, disabled, autoFocus }: { kind: WritingKind; value: string; onChange: (v: string) => void; disabled?: boolean; autoFocus?: boolean }) {
  const t = useT();
  const words = wordCount(value);
  const min = MIN_WORDS[kind];
  const under = min > 0 && words < min;
  return (
    <div className="flex h-full flex-col">
      <textarea
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="sentences"
        aria-label={t('Tu respuesta', 'Your response')}
        placeholder={kind === 'toefl.email' ? 'Dear …,' : t('Escribe aquí tu respuesta…', 'Write your response here…')}
        className="min-h-[340px] w-full flex-1 resize-y rounded-2xl border border-line-strong bg-surface p-4 font-sans text-[15.5px] leading-relaxed outline-none focus:border-accent disabled:opacity-80 lg:min-h-[420px]"
      />
      <div className="mt-2 flex items-center justify-between text-[13px]">
        <span className={cn('font-mono', under ? 'text-warn' : 'text-muted')}>
          {words} {t('palabras', 'words')}
          {min > 0 && ` / ${min}`}
        </span>
        {under && words > 0 && (
          <span className="flex items-center gap-1 text-warn">
            <AlertTriangle size={13} /> {t(`Te faltan ${min - words} palabras para el mínimo`, `${min - words} words below the minimum`)}
          </span>
        )}
        <span className="text-faint">{t('Sin corrector automático, como en el examen', 'No spell-check, as in the exam')}</span>
      </div>
    </div>
  );
}

/* ─────────── Feedback ─────────── */

export interface WritingResult {
  /** IELTS: banda de la tarea. TOEFL: puntuación 0–5. */
  score: number;
  criteria: CriterionEstimate[];
  self?: number;
  ai?: AiFeedback;
}

function checklistFor(kind: WritingKind, task: WritingTaskData, lang: 'es' | 'en'): string[] {
  const es = lang === 'es';
  switch (kind) {
    case 'toefl.email':
      return [...(task as ToeflEmailTask).tasks, es ? 'Saludo y despedida adecuados al destinatario' : 'Greeting and closing suited to the recipient', es ? 'Tono y registro apropiados' : 'Appropriate tone and register'];
    case 'toefl.discussion':
      return es
        ? ['Opinión clara desde la primera frase', 'Aporto una razón NUEVA (no repito a los compañeros)', 'Ejemplo concreto o explicación desarrollada', 'Menciono o respondo a un compañero', 'Al menos 100 palabras']
        : ['Clear opinion from the first sentence', 'A NEW reason (not repeating classmates)', 'Concrete example or developed explanation', 'Engage with a classmate', 'At least 100 words'];
    case 'ielts.task1':
      return [es ? 'Introducción parafraseando el enunciado' : 'Introduction paraphrasing the prompt', es ? 'Overview con las tendencias/rasgos principales' : 'Overview of main trends/features', ...(task as IeltsTask1).keyFeatures, es ? 'Datos concretos que apoyan las comparaciones' : 'Specific data supporting comparisons', es ? 'Sin opiniones ni causas inventadas' : 'No opinions or invented causes'];
    case 'ielts.task2':
      return (task as IeltsTask2).checklist;
  }
}

const IELTS_CRIT: Record<string, { es: string; en: string }> = {
  TA: { es: 'Task Achievement', en: 'Task Achievement' },
  TR: { es: 'Task Response', en: 'Task Response' },
  CC: { es: 'Coherence & Cohesion', en: 'Coherence & Cohesion' },
  LR: { es: 'Lexical Resource', en: 'Lexical Resource' },
  GRA: { es: 'Grammatical Range & Accuracy', en: 'Grammatical Range & Accuracy' },
  TASK: { es: 'Cumplimiento de la tarea', en: 'Task completion' },
  ORG: { es: 'Organización y coherencia', en: 'Organisation & coherence' },
  LANG: { es: 'Uso de la lengua', en: 'Language use' },
};

export function WritingFeedback({ kind, task, text, onResult }: { kind: WritingKind; task: WritingTaskData; text: string; onResult?: (r: WritingResult) => void }) {
  const t = useT();
  const geminiKey = useApp((s) => s.geminiKey);
  const isIelts = kind.startsWith('ielts');
  const [awl, setAwl] = useState<Set<string>>(new Set());
  const [lt, setLt] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; matches: LtMatch[]; error?: string }>({ status: 'idle', matches: [] });
  const checklist = useMemo(() => checklistFor(kind, task, t.lang), [kind, task, t.lang]);
  const [checked, setChecked] = useState<boolean[]>(() => checklist.map(() => false));
  const [self, setSelf] = useState<number | null>(null);
  const [ai, setAi] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; data?: AiFeedback; error?: string }>({ status: 'idle' });

  useEffect(() => {
    loadAwlSet().then(setAwl);
  }, []);

  const runLt = () => {
    setLt({ status: 'loading', matches: [] });
    languageToolCheck(text, isIelts ? 'en-GB' : 'en-US')
      .then((matches) => setLt({ status: 'done', matches }))
      .catch((e) => setLt({ status: 'error', matches: [], error: (e as Error).message }));
  };
  const ran = useRef(false);
  useEffect(() => {
    if (!ran.current && text.trim().length > 20) {
      ran.current = true;
      runLt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = useMemo(() => analyzeText(text, awl), [text, awl]);
  const counts = lt.status === 'done' ? ltCounts(lt.matches) : undefined;
  const ratio = checked.filter(Boolean).length / Math.max(1, checked.length);
  const est = isIelts
    ? (() => {
        const r = estimateIeltsWriting(metrics, { task: kind === 'ielts.task1' ? 1 : 2, lt: counts, checklist: ratio });
        return { score: r.band, criteria: r.criteria };
      })()
    : (() => {
        const r = estimateToeflWriting(metrics, { task: kind === 'toefl.email' ? 'email' : 'discussion', lt: counts, checklist: ratio });
        return { score: r.score, criteria: r.criteria };
      })();

  useEffect(() => {
    onResult?.({ score: self ?? est.score, criteria: est.criteria, self: self ?? undefined, ai: ai.data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [est.score, self, ai.data]);

  const conv = kind === 'toefl.email' ? emailConventions(text) : null;
  const models = (task as { models: Model[] }).models;

  const runAi = async () => {
    setAi({ status: 'loading' });
    try {
      const criteria = isIelts ? [kind === 'ielts.task1' ? 'Task Achievement' : 'Task Response', 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy'] : ['Task completion & development', 'Organisation & coherence', 'Language use (range & accuracy)'];
      const data = await geminiEvaluate(
        geminiKey,
        buildWritingPrompt({
          exam: isIelts ? 'ielts' : 'toefl',
          task: kind,
          prompt: kind === 'ielts.task1' ? `${(task as IeltsTask1).prompt}\nDATA: ${JSON.stringify((task as IeltsTask1).visual)}` : writingPromptText(kind, task),
          answer: text,
          criteria,
          scale: isIelts ? 'IELTS bands 0–9 (half bands allowed)' : 'TOEFL iBT 2026 task score 0–5',
          lang: t.lang,
        }),
      );
      setAi({ status: 'done', data });
    } catch (e) {
      setAi({ status: 'error', error: (e as Error).message });
    }
  };

  return (
    <div className="space-y-5">
      {/* Nota estimada */}
      <Card className="p-5">
        <SectionTitle
          sub={t('Estimación automática y orientativa: no sustituye a un examinador.', 'Automatic, approximate estimate: not a substitute for an examiner.')}
          action={
            <div className="text-right">
              <div className="font-display text-3xl font-bold text-accent">{isIelts ? est.score.toFixed(1) : `${est.score}/5`}</div>
              <div className="text-[11px] text-faint">{isIelts ? t('banda estimada', 'estimated band') : t('puntuación estimada', 'estimated score')}</div>
            </div>
          }
        >
          <span className="flex items-center gap-2">
            <Gauge size={18} className="text-accent" /> {t('Nota estimada por criterio', 'Estimated score by criterion')}
          </span>
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {est.criteria.map((c) => (
            <div key={c.key} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold">{t.x(IELTS_CRIT[c.key])}</span>
                <span className="font-mono text-[15px] font-bold">{isIelts ? c.score.toFixed(1) : c.score}</span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-muted">
                {c.notes.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {conv && (
          <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
            <Badge tone={conv.greeting ? 'good' : 'warn'}>{conv.greeting ? '✓' : '✗'} {t('Saludo', 'Greeting')}</Badge>
            <Badge tone={conv.closing ? 'good' : 'warn'}>{conv.closing ? '✓' : '✗'} {t('Despedida', 'Closing')}</Badge>
          </div>
        )}
      </Card>

      {/* Checklist del enunciado */}
      <Card className="p-5">
        <SectionTitle sub={t('Marca lo que has cubierto de verdad: afecta a la nota de cumplimiento de la tarea.', 'Tick what you genuinely covered: it affects the task-completion score.')}>
          <span className="flex items-center gap-2">
            <ListChecks size={18} className="text-accent" /> {t('¿Has cubierto todo el enunciado?', 'Did you cover the whole prompt?')}
          </span>
        </SectionTitle>
        <ul className="space-y-1.5">
          {checklist.map((c, i) => (
            <li key={i}>
              <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
                <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={checked[i]} onChange={() => setChecked(checked.map((x, j) => (j === i ? !x : x)))} />
                {c}
              </label>
            </li>
          ))}
        </ul>
      </Card>

      {/* LanguageTool */}
      <Card className="p-5">
        <SectionTitle
          sub={t('Corrector gratuito de gramática y ortografía (api.languagetool.org).', 'Free grammar and spelling checker (api.languagetool.org).')}
          action={
            lt.status !== 'loading' && (
              <Button size="sm" variant="outline" onClick={runLt}>
                {t('Volver a comprobar', 'Re-check')}
              </Button>
            )
          }
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-accent" /> LanguageTool
          </span>
        </SectionTitle>
        {lt.status === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin" /> {t('Comprobando…', 'Checking…')}
          </p>
        )}
        {lt.status === 'error' && <Notice tone="warn">{lt.error} {t('(sin conexión, la estimación usa sólo el analizador propio).', '(offline: the estimate uses only the local analyser).')}</Notice>}
        {lt.status === 'done' && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone={counts!.grammar ? 'bad' : 'good'}>
                {counts!.grammar} {t('gramática', 'grammar')}
              </Badge>
              <Badge tone={counts!.spelling ? 'bad' : 'good'}>
                {counts!.spelling} {t('ortografía', 'spelling')}
              </Badge>
              <Badge tone={counts!.style ? 'warn' : 'good'}>
                {counts!.style} {t('estilo/puntuación', 'style/punctuation')}
              </Badge>
            </div>
            <AnnotatedText text={text} matches={lt.matches} />
          </>
        )}
      </Card>

      {/* Métricas */}
      <Card className="p-5">
        <SectionTitle>{t('Análisis del texto', 'Text analysis')}</SectionTitle>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {[
            [t('Palabras', 'Words'), metrics.words],
            [t('Frases', 'Sentences'), metrics.sentences],
            [t('Párrafos', 'Paragraphs'), metrics.paragraphs],
            [t('Long. media frase', 'Avg. sentence'), `${metrics.avgSentenceLength} ± ${metrics.sentenceLengthSd}`],
            ['Type-token ratio', metrics.ttr],
            ['MATTR', metrics.mattr],
            ['% AWL', `${metrics.awlPercent} %`],
            [t('Subordinadas/frase', 'Subordinates/sentence'), metrics.subordinateRatio],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="font-mono text-[15px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid gap-3 text-[13.5px] md:grid-cols-2">
          <div>
            <div className="font-semibold">{t('Conectores', 'Connectors')} ({metrics.connectors.length})</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {metrics.connectors.map((c) => (
                <Badge key={c.phrase} tone={c.count >= 3 ? 'warn' : 'accent'}>
                  {c.phrase}
                  {c.count > 1 && ` ×${c.count}`}
                </Badge>
              ))}
              {!metrics.connectors.length && <span className="text-muted">{t('Ninguno detectado', 'None detected')}</span>}
            </div>
          </div>
          <div>
            <div className="font-semibold">{t('Palabras AWL usadas', 'AWL words used')}</div>
            <div className="mt-1 text-muted">{metrics.awlWords.slice(0, 30).join(', ') || '—'}</div>
          </div>
          {metrics.repeated.length > 0 && (
            <div>
              <div className="font-semibold">{t('Repeticiones', 'Repetitions')}</div>
              <div className="mt-1 text-muted">{metrics.repeated.map((r) => `${r.word} ×${r.count}`).join(', ')}</div>
            </div>
          )}
          {(metrics.contractions.length > 0 || metrics.informal.length > 0) && kind !== 'toefl.email' && (
            <div>
              <div className="font-semibold text-warn">{t('Registro', 'Register')}</div>
              <div className="mt-1 text-muted">
                {metrics.contractions.length > 0 && <>{t('Contracciones', 'Contractions')}: {metrics.contractions.join(', ')}. </>}
                {metrics.informal.length > 0 && <>{t('Informal', 'Informal')}: {metrics.informal.join(', ')}.</>}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Autoevaluación + modelos */}
      <Card className="p-5">
        <SectionTitle sub={t('Compara tu texto con los modelos y ponte nota con la rúbrica.', 'Compare with the models and grade yourself with the rubric.')}>
          <span className="flex items-center gap-2">
            <BookText size={18} className="text-accent" /> {t('Respuestas modelo y autoevaluación', 'Model answers & self-assessment')}
          </span>
        </SectionTitle>
        <Tabs defaultValue={models[0]?.level}>
          <TabsList>
            {models.map((m) => (
              <TabsTrigger key={m.level} value={m.level}>
                {isIelts ? `Band ${m.level}` : `${t('Nota', 'Score')} ${m.level}`}
              </TabsTrigger>
            ))}
          </TabsList>
          {models.map((m) => (
            <TabsContent key={m.level} value={m.level} className="mt-3">
              <div className="rounded-xl border border-line bg-surface-2 p-4 font-serif text-[15px] leading-relaxed whitespace-pre-line">{m.text}</div>
              <p className="mt-1 text-right text-xs text-faint">{wordCount(m.text)} {t('palabras', 'words')}</p>
              <Notice tone="accent" className="mt-2">
                {m.commentary}
              </Notice>
            </TabsContent>
          ))}
        </Tabs>
        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">{t('Tu autoevaluación', 'Your self-assessment')}</div>
          <div className="flex flex-wrap gap-1.5">
            {(isIelts ? [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] : [0, 1, 2, 3, 4, 5]).map((b) => (
              <button
                key={b}
                onClick={() => setSelf(b)}
                aria-pressed={self === b}
                className={cn('h-9 min-w-11 rounded-lg border px-2 font-mono text-sm', self === b ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong hover:border-accent')}
              >
                {isIelts ? b.toFixed(1) : b}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            {t('Si te pones nota, se guarda esa en tu historial (la automática queda como referencia). Revisa la rúbrica en la Study Room.', 'If you self-grade, that score is saved (the automatic one stays as reference). See the rubric in the Study Room.')}
          </p>
        </div>
      </Card>

      {/* IA opcional */}
      <Card className="p-5">
        <SectionTitle sub={t('Opcional: usa tu propia API key gratuita de Google Gemini (se guarda sólo en tu navegador).', 'Optional: use your own free Google Gemini API key (stored only in your browser).')}>
          <span className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" /> {t('Corrección con IA', 'AI feedback')}
          </span>
        </SectionTitle>
        {!geminiKey ? (
          <p className="text-sm text-muted">{t('Añade tu API key en Ajustes para activar esta opción. La app funciona igual sin ella.', 'Add your API key in Settings to enable this. The app works fine without it.')}</p>
        ) : ai.status === 'idle' || ai.status === 'error' ? (
          <>
            {ai.error && <Notice tone="bad" className="mb-3">{ai.error}</Notice>}
            <Button onClick={runAi} variant="outline">
              <Wand2 size={16} /> {t('Corregir con Gemini', 'Grade with Gemini')}
            </Button>
          </>
        ) : ai.status === 'loading' ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin" /> {t('Evaluando…', 'Evaluating…')}
          </p>
        ) : (
          ai.data && <AiFeedbackView data={ai.data} ielts={isIelts} />
        )}
      </Card>
    </div>
  );
}

export function AiFeedbackView({ data, ielts }: { data: AiFeedback; ielts: boolean }) {
  const t = useT();
  return (
    <div className="space-y-4 text-[14px]">
      <div className="flex items-center gap-3">
        <span className="font-display text-3xl font-bold text-accent">{ielts ? Number(data.overall).toFixed(1) : `${data.overall}/5`}</span>
        <span className="text-muted">{t('según la IA (también es una estimación)', 'according to the AI (also an estimate)')}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.criteria?.map((c) => (
          <div key={c.name} className="rounded-xl border border-line p-3">
            <div className="flex justify-between font-semibold">
              <span>{c.name}</span>
              <span className="font-mono">{c.score}</span>
            </div>
            <p className="mt-1 text-[13px] text-muted">{c.comment}</p>
          </div>
        ))}
      </div>
      {data.strengths?.length > 0 && (
        <div>
          <div className="font-semibold text-good">{t('Puntos fuertes', 'Strengths')}</div>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {data.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {data.improvements?.length > 0 && (
        <div>
          <div className="font-semibold text-warn">{t('Qué mejorar', 'What to improve')}</div>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {data.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {data.corrections?.length > 0 && (
        <div>
          <div className="font-semibold">{t('Correcciones', 'Corrections')}</div>
          <ul className="mt-1 space-y-1.5">
            {data.corrections.map((c, i) => (
              <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">
                <span className="text-bad line-through">{c.original}</span> → <span className="font-medium text-good">{c.corrected}</span>
                <div className="text-[12.5px] text-muted">{c.why}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.improvedVersion && (
        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer font-semibold">{t('Versión mejorada', 'Improved version')}</summary>
          <p className="mt-2 font-serif whitespace-pre-line">{data.improvedVersion}</p>
        </details>
      )}
    </div>
  );
}

function AnnotatedText({ text, matches }: { text: string; matches: LtMatch[] }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const parts: React.ReactNode[] = [];
  let last = 0;
  matches
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .forEach((m, i) => {
      if (m.offset < last) return;
      parts.push(<span key={`t${i}`}>{text.slice(last, m.offset)}</span>);
      const spelling = m.issueType === 'misspelling';
      parts.push(
        <button
          key={`m${i}`}
          onClick={() => setOpen(open === i ? null : i)}
          className={cn('rounded-sm underline decoration-2 underline-offset-4', spelling ? 'decoration-bad' : m.issueType === 'style' ? 'decoration-warn' : 'decoration-accent', open === i && 'bg-surface-3')}
        >
          {text.slice(m.offset, m.offset + m.length)}
        </button>,
      );
      last = m.offset + m.length;
    });
  parts.push(<span key="end">{text.slice(last)}</span>);
  const sel = open !== null ? matches.slice().sort((a, b) => a.offset - b.offset)[open] : null;
  return (
    <div>
      <div className="rounded-xl border border-line bg-surface p-4 text-[15px] leading-loose whitespace-pre-wrap">{parts}</div>
      {sel ? (
        <div className="mt-2 rounded-xl bg-surface-2 p-3 text-[13.5px]">
          <div className="font-medium">{sel.message}</div>
          {sel.replacements.length > 0 && (
            <div className="mt-1 text-muted">
              {t('Sugerencias', 'Suggestions')}: <span className="font-medium text-good">{sel.replacements.join(' · ')}</span>
            </div>
          )}
        </div>
      ) : (
        matches.length > 0 && <p className="mt-2 text-xs text-faint">{t('Pulsa una palabra subrayada para ver la explicación.', 'Tap an underlined word to see the explanation.')}</p>
      )}
    </div>
  );
}
