import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Eye, Keyboard, FileText, Volume2, BookOpen } from 'lucide-react';
import { useBank, bankMeta } from '@/content';
import type { BankKey, IeltsListeningPart, IeltsReadingPassage, ToeflBuildItem, ToeflCtwSet, ToeflListeningSet, ToeflReadingSet, Audio } from '@/content/schema';
import { useApp, useUi } from '@/store';
import { useT } from '@/i18n';
import { Button, Card, DifficultyBadge, LoadingBlock, Notice, Badge, Kbd, ProgressBar, ConfirmDialog } from '@/components/ui';
import { CtwView, ToeflReadingView, IeltsReadingView, BuildView, Transcript } from '@/components/questions/SetViews';
import { McqView, Feedback, GroupView, numberItems, type Answers } from '@/components/questions/Items';
import { AudioPlayer } from '@/components/questions/AudioPlayer';
import { PracticeClock } from '@/components/exam/Timer';
import { objectiveItems, OBJECTIVE_BANKS, practiceBand, sectionOfBank } from '@/features/shared/objective';
import { setLabel } from './PracticeList';
import { WritingPrompt, WritingEditor, WritingFeedback, WRITING_MINUTES, MIN_WORDS, writingPromptText, type WritingKind, type WritingTaskData, type WritingResult } from './writing/WritingTask';
import { SpeakingRunner, SpeakingResults, type SpeakingKind, type SpeakingTaskData, type SpeakingOutcome } from './speaking/SpeakingTask';
import { repeatAccuracy } from '@/engine/speaking';
import { playAudio } from '@/engine/tts';
import type { Response } from '@/engine/grading';
import { cn, pct, wordCount } from '@/lib/cn';
import { proportionToBand } from '@/engine/scoring/toefl';
import { ieltsRound } from '@/engine/scoring/ielts';

type AnySet = { id: string; usage: string; difficulty: 'easy' | 'medium' | 'hard' };

export default function PracticeRun() {
  const t = useT();
  const { bank = '', id = '' } = useParams();
  const meta = bankMeta(bank);
  const { data } = useBank((meta?.key as BankKey) ?? null);
  const list = useMemo(() => ((data ?? []) as unknown as AnySet[]).filter((s) => s.usage !== 'mock'), [data]);
  const idx = list.findIndex((s) => s.id === id);
  const set = list[idx];
  const next = list[idx + 1];
  const prev = list[idx - 1];

  if (!meta) return null;
  if (!data) return <LoadingBlock />;
  if (!set) return <Notice tone="bad">{t('Ejercicio no encontrado.', 'Exercise not found.')}</Notice>;

  const kind = OBJECTIVE_BANKS.includes(bank) ? 'objective' : /email|discussion|task1|task2/.test(bank) ? 'writing' : 'speaking';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/practice/${bank}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> {meta.title}
          </Link>
          <h1 className="mt-1 truncate font-display text-xl font-bold sm:text-2xl">{setLabel(set as never)}</h1>
          <div className="mt-1 flex items-center gap-2">
            <DifficultyBadge d={set.difficulty} lang={t.lang} />
            <span className="text-xs text-faint">
              {idx + 1} / {list.length}
            </span>
            {meta.lesson && (
              <Link to={`/study/lesson/${meta.lesson}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                <BookOpen size={12} /> {t('Guía', 'Guide')}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {kind !== 'speaking' && <PracticeClock key={id} minutes={meta.minutes} />}
          {prev && (
            <Link to={`/practice/${bank}/${prev.id}`}>
              <Button variant="ghost" size="icon" aria-label={t('Anterior', 'Previous')}>
                <ArrowLeft size={16} />
              </Button>
            </Link>
          )}
          {next && (
            <Link to={`/practice/${bank}/${next.id}`}>
              <Button variant="outline" size="sm">
                {t('Siguiente', 'Next')} <ArrowRight size={15} />
              </Button>
            </Link>
          )}
        </div>
      </div>
      {kind === 'objective' && <ObjectiveRun key={id} bank={bank} set={set} nextId={next?.id} />}
      {kind === 'writing' && <WritingRun key={id} bank={bank as WritingKind} task={set as unknown as WritingTaskData} />}
      {kind === 'speaking' && <SpeakingRun key={id} bank={bank as SpeakingKind} task={set as unknown as SpeakingTaskData} />}
    </div>
  );
}

/* ───────────────────────── Objetivas ───────────────────────── */

function ObjectiveRun({ bank, set, nextId }: { bank: string; set: AnySet; nextId?: string }) {
  const t = useT();
  const nav = useNavigate();
  const exam = useUi((s) => s.exam);
  const { saveAttempt, saveDraft, clearDraft, drafts } = useApp();
  const draftKey = `practice:${bank}:${set.id}`;
  const [answers, setAnswers] = useState<Answers>(() => (drafts[draftKey] as Answers) ?? {});
  const [reveal, setReveal] = useState(false);
  const [audioDone, setAudioDone] = useState(false);
  const [showQs, setShowQs] = useState(bank === 'ielts.listening');
  const started = useRef(Date.now());
  const setAnswer = useCallback((qid: string, v: Response) => setAnswers((a) => ({ ...a, [qid]: v })), []);

  useEffect(() => {
    if (!reveal) saveDraft(draftKey, answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  const items = useMemo(() => (reveal ? objectiveItems(bank, set, answers) : []), [reveal, bank, set, answers]);
  const earned = items.reduce((s, i) => s + i.earned, 0);
  const max = items.reduce((s, i) => s + i.max, 0);

  const check = () => {
    setReveal(true);
    const its = objectiveItems(bank, set, answers);
    const section = sectionOfBank(bank);
    saveAttempt({
      exam,
      kind: 'practice',
      bank,
      setId: set.id,
      title: setLabel(set as never),
      sections: [section],
      startedAt: started.current,
      finishedAt: Date.now(),
      durationSec: Math.round((Date.now() - started.current) / 1000),
      items: its,
      bands: { [section]: practiceBand(bank, its) },
    });
    clearDraft(draftKey);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const retry = () => {
    setAnswers({});
    setReveal(false);
    setAudioDone(false);
    started.current = Date.now();
  };

  // Atajos: A–D / 1–4 para la opción (sets de una pregunta), Enter para corregir, → siguiente
  const singleMcq = bank === 'toefl.response' ? (set as unknown as ToeflListeningSet).questions[0] : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (singleMcq && !reveal) {
        const k = e.key.toLowerCase();
        const i = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k);
        if (i >= 0 && i < singleMcq.options.length) setAnswer(singleMcq.id, i);
      }
      if (e.key === 'Enter' && !reveal && Object.keys(answers).length) check();
      else if ((e.key === 'ArrowRight' || e.key === 'Enter') && reveal && nextId) nav(`/practice/${bank}/${nextId}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let body: React.ReactNode = null;
  let audio: Audio | null = null;
  switch (bank) {
    case 'toefl.ctw':
      body = <CtwView set={set as unknown as ToeflCtwSet} answers={answers} setAnswer={setAnswer} reveal={reveal} />;
      break;
    case 'toefl.daily':
    case 'toefl.passage':
      body = <ToeflReadingView set={set as unknown as ToeflReadingSet} answers={answers} setAnswer={setAnswer} reveal={reveal} />;
      break;
    case 'ielts.reading':
      body = <IeltsReadingView passage={set as unknown as IeltsReadingPassage} answers={answers} setAnswer={setAnswer} reveal={reveal} />;
      break;
    case 'toefl.build': {
      const it = set as unknown as ToeflBuildItem;
      body = <BuildView item={it} value={answers[it.id]} onChange={(v) => setAnswer(it.id, v)} reveal={reveal} />;
      break;
    }
    case 'ielts.listening': {
      const p = set as unknown as IeltsListeningPart;
      audio = p.audio;
      const numbers = numberItems(p.groups, Number(p.groups[0]?.items[0]?.id.replace(/\D/g, '')) || 1);
      body = (
        <div className="space-y-5">
          <AudioPlayer audio={p.audio} mode="practice" context={`Part ${p.part}. ${p.context}`} onEnd={() => setAudioDone(true)} />
          <Notice tone="accent">{t('En el examen real el audio se oye UNA sola vez. Aquí puedes pausar y repetir; en los simulacros, no.', 'In the real exam you hear the audio ONCE. Here you can pause and replay; in mocks you cannot.')}</Notice>
          <div className="space-y-8">
            {p.groups.map((g) => (
              <GroupView key={g.id} group={g} answers={answers} setAnswer={setAnswer} reveal={reveal} numbers={numbers} />
            ))}
          </div>
        </div>
      );
      break;
    }
    default: {
      // TOEFL listening
      const s = set as unknown as ToeflListeningSet;
      audio = s.audio;
      body = (
        <div className="mx-auto max-w-2xl space-y-5">
          <AudioPlayer audio={s.audio} mode="practice" context={s.context} onEnd={() => setAudioDone(true)} />
          {!showQs && !audioDone && !reveal ? (
            <div className="text-center">
              <p className="text-sm text-muted">{t('En el examen las preguntas aparecen al terminar el audio.', 'In the exam, questions appear after the audio.')}</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowQs(true)}>
                <Eye size={15} /> {t('Ver preguntas ya', 'Show questions now')}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {s.questions.map((q, i) => (
                <div key={q.id}>
                  <McqView item={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} reveal={reveal} number={s.questions.length > 1 ? `${i + 1}.` : undefined} />
                  {reveal && <Feedback item={q} value={answers[q.id]} />}
                </div>
              ))}
              {singleMcq && !reveal && (
                <p className="flex items-center gap-1.5 text-xs text-faint">
                  <Keyboard size={13} /> <Kbd>A</Kbd>–<Kbd>D</Kbd> {t('elegir', 'choose')} · <Kbd>Enter</Kbd> {t('corregir', 'check')} · <Kbd>→</Kbd> {t('siguiente', 'next')}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }
  }

  const evidence = useMemo(() => {
    if (!reveal || !audio) return [];
    const s = set as unknown as { questions?: { evidence?: string }[]; groups?: { items: { evidence?: string }[] }[] };
    return (s.questions ?? s.groups?.flatMap((g) => g.items) ?? []).map((q) => q.evidence ?? '').filter(Boolean);
  }, [reveal, audio, set]);

  return (
    <div>
      {reveal && (
        <Card className="mb-5 flex flex-wrap items-center gap-4 p-4">
          <div className={cn('font-display text-3xl font-bold', pct(earned, max) >= 70 ? 'text-good' : pct(earned, max) >= 50 ? 'text-warn' : 'text-bad')}>
            {earned}/{max}
          </div>
          <div className="min-w-40 flex-1">
            <ProgressBar value={earned} max={max} tone={pct(earned, max) >= 70 ? 'good' : 'warn'} />
            <p className="mt-1 text-xs text-muted">{t('Revisa abajo la explicación de cada respuesta.', 'See the explanation of each answer below.')}</p>
          </div>
          <Button variant="secondary" onClick={retry}>
            <RotateCcw size={15} /> {t('Repetir', 'Retry')}
          </Button>
          {nextId && (
            <Link to={`/practice/${bank}/${nextId}`}>
              <Button>
                {t('Siguiente ejercicio', 'Next exercise')} <ArrowRight size={15} />
              </Button>
            </Link>
          )}
        </Card>
      )}
      {body}
      {!reveal && (
        <div className="sticky bottom-20 z-10 mt-6 flex justify-end lg:bottom-4">
          <Button size="lg" onClick={check} className="shadow-lg">
            <Check size={17} /> {t('Comprobar respuestas', 'Check answers')}
          </Button>
        </div>
      )}
      {reveal && audio && (
        <div className="mt-8 space-y-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText size={18} className="text-accent" /> {t('Transcripción', 'Transcript')}
          </h2>
          <Transcript audio={audio} evidence={evidence} />
          <Dictation audio={audio} />
        </div>
      )}
    </div>
  );
}

/** Dictado palabra a palabra como ejercicio extra de Listening. */
function Dictation({ audio }: { audio: Audio }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(0);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const lines = audio.lines.filter((l) => l.t.split(/\s+/).length >= 4);
  const cur = lines[line];
  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Keyboard size={16} /> {t('Dictado (ejercicio extra)', 'Dictation (extra exercise)')}
      </Button>
    );
  if (!cur) return null;
  const res = checked ? repeatAccuracy(cur.t, text) : null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{t('Dictado', 'Dictation')}</h3>
        <span className="font-mono text-xs text-muted">
          {line + 1}/{lines.length}
        </span>
      </div>
      <Button size="sm" variant="secondary" onClick={() => playAudio({ speakers: audio.speakers, lines: [cur] }, { rate: 0.9 })}>
        <Volume2 size={15} /> {t('Escuchar la frase', 'Play the line')}
      </Button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={checked} className="mt-3 h-20 w-full rounded-xl border border-line-strong bg-surface p-3 text-[15px] outline-none focus:border-accent" placeholder={t('Escribe exactamente lo que oyes…', 'Type exactly what you hear…')} spellCheck={false} />
      {res && (
        <div className="mt-2 rounded-xl bg-surface-2 p-3 text-[14.5px]">
          <Badge tone={res.accuracy > 0.9 ? 'good' : 'warn'}>{Math.round(res.accuracy * 100)} %</Badge>
          <p className="mt-2">
            {res.diff.map((d, i) => (
              <span key={i} className={cn('mr-1', d.status === 'missing' && 'font-semibold text-bad underline', d.status === 'extra' && 'text-warn line-through')}>
                {d.word}
              </span>
            ))}
          </p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {!checked ? (
          <Button size="sm" onClick={() => setChecked(true)} disabled={!text.trim()}>
            {t('Comprobar', 'Check')}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setLine((l) => (l + 1) % lines.length);
              setText('');
              setChecked(false);
            }}
          >
            {t('Siguiente frase', 'Next line')} <ArrowRight size={14} />
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────── Writing ───────────────────────── */

function WritingRun({ bank, task }: { bank: WritingKind; task: WritingTaskData }) {
  const t = useT();
  const exam = useUi((s) => s.exam);
  const { saveAttempt, saveDraft, clearDraft, drafts } = useApp();
  const draftKey = `practice:${bank}:${task.id}`;
  const [text, setText] = useState<string>(() => (drafts[draftKey] as string) ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const attemptId = useRef<string | null>(null);
  const started = useRef(Date.now());
  const isIelts = bank.startsWith('ielts');

  useEffect(() => {
    if (!submitted) saveDraft(draftKey, text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const onResult = (r: WritingResult) => {
    const band = isIelts ? ieltsRound(r.score) : proportionToBand(r.score / 5);
    attemptId.current = saveAttempt({
      id: attemptId.current ?? undefined,
      exam,
      kind: 'practice',
      bank,
      setId: task.id,
      title: writingPromptText(bank, task).slice(0, 90),
      sections: ['writing'],
      startedAt: started.current,
      finishedAt: Date.now(),
      durationSec: Math.round((Date.now() - started.current) / 1000),
      items: [{ qid: task.id, qtype: bank, section: 'writing', earned: r.score, max: isIelts ? 9 : 5, correct: isIelts ? r.score >= 7 : r.score >= 4 }],
      bands: { writing: band },
      detail: { text, criteria: r.criteria, self: r.self, ai: r.ai },
    });
  };

  const submit = () => {
    setSubmitted(true);
    clearDraft(draftKey);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const words = wordCount(text);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="scroll-thin lg:max-h-[calc(100dvh-170px)] lg:overflow-y-auto lg:pr-2">
          <WritingPrompt kind={bank} task={task} />
        </div>
        <div className="flex flex-col">
          <WritingEditor kind={bank} value={text} onChange={setText} disabled={submitted} />
          {!submitted && (
            <div className="mt-3 flex justify-end">
              <Button size="lg" onClick={() => (MIN_WORDS[bank] && words < MIN_WORDS[bank] ? setConfirm(true) : submit())} disabled={words < 10}>
                <Check size={17} /> {t('Entregar y corregir', 'Submit & get feedback')}
              </Button>
            </div>
          )}
          {!submitted && <p className="mt-2 text-right text-xs text-faint">{t(`Tiempo recomendado: ${WRITING_MINUTES[bank]} min. Tu texto se guarda solo.`, `Suggested time: ${WRITING_MINUTES[bank]} min. Your text autosaves.`)}</p>}
        </div>
      </div>
      {submitted && <WritingFeedback kind={bank} task={task} text={text} onResult={onResult} />}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('No llegas al mínimo de palabras', 'Below the word minimum')}
        description={t(`Llevas ${words} de ${MIN_WORDS[bank]} palabras. En el examen, un texto corto limita la nota. ¿Entregar igualmente?`, `You have ${words} of ${MIN_WORDS[bank]} words. In the exam a short text limits your score. Submit anyway?`)}
        confirm={t('Entregar', 'Submit')}
        cancel={t('Seguir escribiendo', 'Keep writing')}
        onConfirm={submit}
      />
    </div>
  );
}

/* ───────────────────────── Speaking ───────────────────────── */

function SpeakingRun({ bank, task }: { bank: SpeakingKind; task: SpeakingTaskData }) {
  const exam = useUi((s) => s.exam);
  const saveAttempt = useApp((s) => s.saveAttempt);
  const [outcome, setOutcome] = useState<SpeakingOutcome | null>(null);
  const [run, setRun] = useState(0);
  const started = useRef(Date.now());
  const attemptId = useRef<string | null>(null);
  const t = useT();
  const isIelts = bank.startsWith('ielts');

  const save = (o: SpeakingOutcome, self?: number) => {
    const band = self ?? (isIelts ? o.band ?? 4 : proportionToBand((o.itemScores ?? []).reduce((a, b) => a + b, 0) / Math.max(1, (o.itemScores?.length ?? 1) * 5)));
    attemptId.current = saveAttempt({
      id: attemptId.current ?? undefined,
      exam,
      kind: 'practice',
      bank,
      setId: task.id,
      title: (task as { topic?: string }).topic ?? (task as { context?: string }).context?.slice(0, 80) ?? task.id,
      sections: ['speaking'],
      startedAt: started.current,
      finishedAt: Date.now(),
      durationSec: Math.round(o.responses.reduce((s, r) => s + r.durationSec, 0)),
      items: o.itemScores
        ? o.itemScores.map((s, i) => ({ qid: `${task.id}#${i}`, qtype: bank, section: 'speaking', earned: s, max: 5, correct: s >= 4 }))
        : [{ qid: task.id, qtype: bank, section: 'speaking', earned: o.band ?? 0, max: 9, correct: (o.band ?? 0) >= 7 }],
      bands: { speaking: band },
      detail: { transcripts: o.responses.map((r) => ({ prompt: r.prompt, transcript: r.transcript, wpm: r.metrics.wpm })), self },
    });
  };

  return outcome ? (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => {
            setOutcome(null);
            attemptId.current = null;
            started.current = Date.now();
            setRun((r) => r + 1);
          }}
        >
          <RotateCcw size={15} /> {t('Repetir', 'Retry')}
        </Button>
      </div>
      <SpeakingResults kind={bank} task={task} outcome={outcome} onSelf={(v) => save(outcome, v)} />
    </div>
  ) : (
    <SpeakingRunner
      key={run}
      kind={bank}
      task={task}
      mode="practice"
      onComplete={(o) => {
        setOutcome(o);
        save(o);
      }}
    />
  );
}
