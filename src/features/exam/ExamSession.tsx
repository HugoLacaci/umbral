import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Pause, Play, Flag, Loader2, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/store';
import { useT } from '@/i18n';
import { Button, ConfirmDialog, LoadingBlock, Notice } from '@/components/ui';
import { useApplyTheme } from '@/components/layout/AppShell';
import { useCountdown, TimerDisplay } from '@/components/exam/Timer';
import { CtwView, ToeflReadingView, IeltsReadingView, BuildView } from '@/components/questions/SetViews';
import { McqView, GroupView, numberItems, countQuestions, type Answers } from '@/components/questions/Items';
import { AudioPlayer } from '@/components/questions/AudioPlayer';
import { WritingPrompt, WritingEditor } from '@/features/practice/writing/WritingTask';
import { SpeakingRunner, type SpeakingOutcome } from '@/features/practice/speaking/SpeakingTask';
import type { ToeflCtwSet, ToeflListeningSet, ToeflReadingSet, IeltsListeningPart } from '@/content/schema';
import type { Response } from '@/engine/grading';
import type { Skill } from '@/engine/plan';
import { cn, wordCount } from '@/lib/cn';
import { loadMock, mockIsComplete, scoreMock, routerDecision, scopedAnswers, TOEFL_TIME, IELTS_TIME, type ExamState, type Mock, type ToeflMock, type IeltsMock, type Scope, type MockSet } from './mock';

const SECTION_NAME: Record<Skill, string> = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' };

export default function ExamSession() {
  useApplyTheme();
  const t = useT();
  const nav = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();
  const exam = params.exam as 'toefl' | 'ielts';
  const mockNo = Number(params.mock);
  const scope = (params.scope ?? 'full') as Scope;
  const key = `exam:${exam}:${mockNo}:${scope}`;
  const { drafts, saveDraft, clearDraft, saveAttempt, name } = useApp();
  const [mock, setMock] = useState<Mock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  const [st, setSt] = useState<ExamState>(() => {
    const saved = drafts[key] as ExamState | undefined;
    if (saved?.version === 1) return saved;
    const order: Skill[] = exam === 'toefl' ? ['reading', 'listening', 'writing', 'speaking'] : ['listening', 'reading', 'writing', 'speaking'];
    return {
      version: 1,
      exam,
      mock: mockNo,
      scope,
      flexible: search.get('flex') === '1',
      startedAt: Date.now(),
      sections: scope === 'full' ? order : [scope],
      sectionIdx: 0,
      step: 0,
      endsAt: null,
      pausedLeft: null,
      phase: 'intro',
      path: {},
      module: {},
      answers: {},
      texts: {},
      speaking: [],
      timings: {},
      flags: [],
      pauses: 0,
    };
  });

  useEffect(() => {
    loadMock(exam, mockNo)
      .then((m) => (mockIsComplete(m) ? setMock(m) : setError(t('Este simulacro todavía no tiene todo el contenido.', 'This mock is missing content.'))))
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, mockNo]);

  // Autoguardado (si cierras la pestaña, puedes retomarlo desde Simulacros)
  useEffect(() => {
    if (!finishing) saveDraft(key, st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const section = st.sections[st.sectionIdx];
  const patch = useCallback((p: Partial<ExamState> | ((s: ExamState) => Partial<ExamState>)) => setSt((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) })), []);

  // Tiempo por set
  const lastAt = useRef(Date.now());
  const trackTime = (id: string) => {
    const now = Date.now();
    const d = Math.round((now - lastAt.current) / 1000);
    lastAt.current = now;
    patch((s) => ({ timings: { ...s.timings, [id]: (s.timings[id] ?? 0) + d } }));
  };

  const setAnswerFor = useCallback((setId: string) => (itemId: string, v: Response) => patch((s) => ({ answers: { ...s.answers, [`${setId}::${itemId}`]: v } })), [patch]);

  const finish = async (state: ExamState) => {
    if (!mock) return;
    setFinishing(true);
    const r = await scoreMock(mock, state);
    const id = saveAttempt({
      exam,
      kind: 'mock',
      mockNo,
      title: `${exam === 'toefl' ? 'TOEFL iBT' : 'IELTS Academic'} · ${t('Simulacro', 'Mock')} ${mockNo}${scope !== 'full' ? ` · ${SECTION_NAME[scope as Skill]}` : ''}`,
      sections: state.sections,
      startedAt: state.startedAt,
      finishedAt: Date.now(),
      durationSec: Math.round((Date.now() - state.startedAt) / 1000),
      flexible: state.flexible,
      items: r.items,
      bands: r.bands,
      overall: r.overall,
      detail: { ...r.detail, scope, candidate: name },
    });
    clearDraft(key);
    nav(`/exam/report/${id}`, { replace: true });
  };

  const nextSection = (s: ExamState) => {
    if (s.sectionIdx + 1 >= s.sections.length) {
      finish(s);
      return;
    }
    setSt({ ...s, sectionIdx: s.sectionIdx + 1, step: 0, phase: 'intro', endsAt: null, pausedLeft: null });
  };

  const onExpire = useCallback(() => {
    // Lo gestiona cada sección mediante expireRef
    expireRef.current?.();
  }, []);
  const expireRef = useRef<(() => void) | null>(null);
  const left = useCountdown(st.endsAt, onExpire, st.pausedLeft !== null);
  const shownLeft = st.pausedLeft ?? left;

  const togglePause = () => {
    if (!st.flexible) return;
    if (st.pausedLeft !== null) patch({ endsAt: Date.now() + st.pausedLeft * 1000, pausedLeft: null });
    else patch((s) => ({ pausedLeft: left, pauses: s.pauses + 1 }));
  };

  if (error)
    return (
      <div className="mx-auto max-w-lg p-8">
        <Notice tone="bad">{error}</Notice>
        <Button className="mt-4" onClick={() => nav('/exam')}>
          {t('Volver', 'Back')}
        </Button>
      </div>
    );
  if (!mock || finishing)
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        {finishing ? (
          <p className="flex items-center justify-center gap-2 text-muted">
            <Loader2 className="animate-spin" size={18} /> {t('Calculando resultados…', 'Scoring…')}
          </p>
        ) : (
          <LoadingBlock />
        )}
      </div>
    );

  /* ─────────── Cabecera tipo CBT ─────────── */
  const sectionLabel = section ? SECTION_NAME[section] : '';
  const moduleLabel =
    exam === 'toefl' && (section === 'reading' || section === 'listening') && st.phase !== 'intro' ? ` · ${st.module[section] === undefined || st.module[section] === 'router' ? 'Module 1' : 'Module 2'}` : '';

  let body: React.ReactNode = null;
  let nav2: React.ReactNode = null;

  if (st.phase === 'intro') {
    body = <SectionIntro exam={exam} section={section} flexible={st.flexible} onBegin={() => beginSection()} />;
  } else if (exam === 'toefl') {
    const m = mock as ToeflMock;
    if (section === 'reading' || section === 'listening') {
      const mod = st.module[section] ?? 'router';
      const sets = m[section][mod];
      const cur = sets[st.step];
      const endModule = (s: ExamState) => {
        if (mod === 'router') {
          const d = routerDecision(sets, s.answers);
          setSt({ ...s, module: { ...s.module, [section]: d.module }, path: { ...s.path, [section]: d.module }, step: 0, phase: 'transition', endsAt: null });
        } else nextSection(s);
      };
      expireRef.current = () => endModule(st);
      if (st.phase === 'transition')
        body = (
          <Center>
            <h2 className="text-2xl font-bold">{sectionLabel} · Module 2</h2>
            <p className="mt-2 max-w-md text-muted">{t('Has terminado el primer módulo. El segundo módulo se ha elegido según tus resultados.', 'You have finished the first module. The second module has been selected based on your performance.')}</p>
            <Button
              size="lg"
              className="mt-6"
              onClick={() => {
                lastAt.current = Date.now();
                patch({ phase: 'run', endsAt: Date.now() + TOEFL_TIME[section][st.module[section] as 'lower' | 'upper'] * 1000 });
              }}
            >
              {t('Continuar', 'Continue')} <ChevronRight size={16} />
            </Button>
          </Center>
        );
      else {
        body = <ToeflRLPage key={cur.set.id} ms={cur} answers={scopedAnswers(st.answers, cur.set.id)} setAnswer={setAnswerFor(cur.set.id)} />;
        const goNext = () => {
          trackTime(cur.set.id);
          if (st.step + 1 < sets.length) patch({ step: st.step + 1 });
          else endModule(st);
        };
        nav2 = (
          <>
            {section === 'reading' && st.step > 0 && (
              <ExamBtn
                onClick={() => {
                  trackTime(cur.set.id);
                  patch({ step: st.step - 1 });
                }}
              >
                <ChevronLeft size={16} /> Back
              </ExamBtn>
            )}
            <span className="hidden text-[13px] text-white/70 sm:inline">
              {st.step + 1} / {sets.length}
            </span>
            <ExamBtn primary onClick={goNext}>
              Next <ChevronRight size={16} />
            </ExamBtn>
          </>
        );
      }
    } else if (section === 'writing') {
      const nb = m.build.length;
      const block = st.step < nb ? 'build' : st.step === nb ? 'email' : 'discussion';
      const toBlock = (b: 'email' | 'discussion' | 'end') => {
        if (b === 'end') nextSection(st);
        else patch({ step: b === 'email' ? nb : nb + 1, endsAt: Date.now() + TOEFL_TIME.writing[b] * 1000 });
      };
      expireRef.current = () => toBlock(block === 'build' ? 'email' : block === 'email' ? 'discussion' : 'end');
      if (block === 'build') {
        const it = m.build[st.step];
        body = (
          <div className="px-4 py-8">
            <p className="mb-2 text-center text-[13px] text-muted">Build a Sentence · {st.step + 1} / {nb}</p>
            <BuildView item={it} value={st.answers[`${it.id}::${it.id}`]} onChange={(v) => setAnswerFor(it.id)(it.id, v)} />
          </div>
        );
        nav2 = (
          <>
            {st.step > 0 && (
              <ExamBtn onClick={() => patch({ step: st.step - 1 })}>
                <ChevronLeft size={16} /> Back
              </ExamBtn>
            )}
            <ExamBtn primary onClick={() => (st.step + 1 < nb ? patch({ step: st.step + 1 }) : toBlock('email'))}>
              Next <ChevronRight size={16} />
            </ExamBtn>
          </>
        );
      } else {
        const kind = block === 'email' ? 'toefl.email' : 'toefl.discussion';
        const task = block === 'email' ? m.email : m.discussion;
        body = (
          <div className="grid gap-5 p-4 lg:grid-cols-2 lg:p-6">
            <div>
              <WritingPrompt kind={kind} task={task} />
            </div>
            <WritingEditor kind={kind} value={st.texts[block] ?? ''} onChange={(v) => patch((s) => ({ texts: { ...s.texts, [block]: v } }))} autoFocus />
          </div>
        );
        nav2 = (
          <ExamBtn primary onClick={() => toBlock(block === 'email' ? 'discussion' : 'end')}>
            Next <ChevronRight size={16} />
          </ExamBtn>
        );
      }
    } else if (section === 'speaking') {
      expireRef.current = null;
      const tasks = [
        { kind: 'toefl.repeat' as const, task: m.repeat },
        { kind: 'toefl.interview' as const, task: m.interview },
      ];
      const cur = tasks[st.step];
      body = (
        <div className="px-4 py-8">
          <p className="mb-4 text-center text-[13px] text-muted">{cur.kind === 'toefl.repeat' ? 'Listen and Repeat' : 'Take an Interview'}</p>
          <SpeakingRunner
            key={cur.task.id}
            kind={cur.kind}
            task={cur.task}
            mode="exam"
            onComplete={(o) => {
              const saved = { ...st, speaking: [...st.speaking, toSaved(cur.kind, o)] };
              if (st.step + 1 < tasks.length) setSt({ ...saved, step: st.step + 1 });
              else nextSection(saved);
            }}
          />
        </div>
      );
    }
  } else {
    const m = mock as IeltsMock;
    if (section === 'listening') {
      const isReview = st.step >= m.listening.length;
      expireRef.current = isReview ? () => nextSection(st) : null;
      if (isReview) {
        body = (
          <div className="mx-auto max-w-4xl space-y-10 p-4 lg:p-6">
            <Notice tone="warn">{t('Tienes 2 minutos para revisar tus respuestas.', 'You have 2 minutes to check your answers.')}</Notice>
            {m.listening.map((p) => (
              <IeltsListeningQuestions key={p.id} part={p} answers={scopedAnswers(st.answers, p.id)} setAnswer={setAnswerFor(p.id)} />
            ))}
          </div>
        );
        nav2 = (
          <ExamBtn primary onClick={() => nextSection(st)}>
            {t('Entregar Listening', 'Submit Listening')} <ChevronRight size={16} />
          </ExamBtn>
        );
      } else {
        const p = m.listening[st.step];
        body = (
          <IeltsListeningPartPage
            key={p.id}
            part={p}
            last={st.step === m.listening.length - 1}
            answers={scopedAnswers(st.answers, p.id)}
            setAnswer={setAnswerFor(p.id)}
            flexible={st.flexible}
            onDone={() => {
              trackTime(p.id);
              if (st.step + 1 < m.listening.length) patch({ step: st.step + 1 });
              else patch({ step: m.listening.length, endsAt: Date.now() + IELTS_TIME.listeningReview * 1000 });
            }}
          />
        );
      }
    } else if (section === 'reading') {
      expireRef.current = () => nextSection(st);
      const p = m.reading[st.step];
      let start = 1;
      for (let k = 0; k < st.step; k++) start += countQuestions(m.reading[k].groups);
      const flags = new Set(st.flags);
      body = (
        <div className="p-4 lg:p-6">
          <IeltsReadingView
            key={p.id}
            passage={p}
            answers={scopedAnswers(st.answers, p.id)}
            setAnswer={setAnswerFor(p.id)}
            startNumber={start}
            flags={new Set([...flags].filter((f) => f.startsWith(`${p.id}::`)).map((f) => f.split('::')[1]))}
            onFlag={(id) => patch((s) => ({ flags: s.flags.includes(`${p.id}::${id}`) ? s.flags.filter((x) => x !== `${p.id}::${id}`) : [...s.flags, `${p.id}::${id}`] }))}
          />
        </div>
      );
      nav2 = (
        <>
          {st.step > 0 && (
            <ExamBtn
              onClick={() => {
                trackTime(p.id);
                patch({ step: st.step - 1 });
              }}
            >
              <ChevronLeft size={16} /> Passage {st.step}
            </ExamBtn>
          )}
          {st.step < m.reading.length - 1 ? (
            <ExamBtn
              primary
              onClick={() => {
                trackTime(p.id);
                patch({ step: st.step + 1 });
              }}
            >
              Passage {st.step + 2} <ChevronRight size={16} />
            </ExamBtn>
          ) : (
            <ExamBtn primary onClick={() => setSubmitOpen(true)}>
              {t('Entregar Reading', 'Submit Reading')}
            </ExamBtn>
          )}
        </>
      );
    } else if (section === 'writing') {
      expireRef.current = () => nextSection(st);
      const which = st.step === 0 ? 'task1' : 'task2';
      const kind = which === 'task1' ? 'ielts.task1' : 'ielts.task2';
      body = (
        <div className="grid gap-5 p-4 lg:grid-cols-2 lg:p-6">
          <div className="scroll-thin lg:max-h-[calc(100dvh-150px)] lg:overflow-y-auto">
            <WritingPrompt kind={kind} task={which === 'task1' ? m.task1 : m.task2} />
          </div>
          <WritingEditor key={which} kind={kind} value={st.texts[which] ?? ''} onChange={(v) => patch((s) => ({ texts: { ...s.texts, [which]: v } }))} autoFocus />
        </div>
      );
      nav2 = (
        <>
          {(['task1', 'task2'] as const).map((k, i) => (
            <ExamBtn key={k} primary={st.step === i} onClick={() => patch({ step: i })}>
              Task {i + 1} <span className="font-mono text-[11px] opacity-75">({wordCount(st.texts[k] ?? '')})</span>
            </ExamBtn>
          ))}
          <ExamBtn onClick={() => setSubmitOpen(true)}>{t('Entregar', 'Submit')}</ExamBtn>
        </>
      );
    } else if (section === 'speaking') {
      expireRef.current = null;
      const tasks = [...m.p1.map((x) => ({ kind: 'ielts.p1' as const, task: x })), { kind: 'ielts.p2' as const, task: m.p2 }, { kind: 'ielts.p3' as const, task: m.p3 }];
      const cur = tasks[st.step];
      body = (
        <div className="px-4 py-8">
          <p className="mb-4 text-center text-[13px] text-muted">{cur.kind === 'ielts.p1' ? 'Part 1' : cur.kind === 'ielts.p2' ? 'Part 2' : 'Part 3'}</p>
          <SpeakingRunner
            key={cur.task.id}
            kind={cur.kind}
            task={cur.task}
            mode="exam"
            onComplete={(o) => {
              const saved = { ...st, speaking: [...st.speaking, toSaved(cur.kind, o)] };
              if (st.step + 1 < tasks.length) setSt({ ...saved, step: st.step + 1 });
              else nextSection(saved);
            }}
          />
        </div>
      );
    }
  }

  function beginSection() {
    lastAt.current = Date.now();
    const s = section;
    if (exam === 'toefl') {
      if (s === 'reading' || s === 'listening') patch({ phase: 'run', step: 0, module: { ...st.module, [s]: 'router' }, endsAt: Date.now() + TOEFL_TIME[s].router * 1000 });
      else if (s === 'writing') patch({ phase: 'run', step: 0, endsAt: Date.now() + TOEFL_TIME.writing.build * 1000 });
      else patch({ phase: 'run', step: 0, endsAt: null });
    } else {
      if (s === 'reading') patch({ phase: 'run', step: 0, endsAt: Date.now() + IELTS_TIME.reading * 1000 });
      else if (s === 'writing') patch({ phase: 'run', step: 0, endsAt: Date.now() + IELTS_TIME.writing * 1000 });
      else patch({ phase: 'run', step: 0, endsAt: null });
    }
  }

  return (
    <div className="exam-ui flex min-h-dvh flex-col">
      <header className="exam-bar sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-white/60">
            {exam === 'toefl' ? 'TOEFL iBT' : 'IELTS Academic'} · Practice Test {mockNo} {st.flexible && <span className="ml-1 rounded bg-amber-400/20 px-1.5 text-amber-300">{t('modo flexible', 'flexible mode')}</span>}
          </div>
          <div className="truncate text-[15px] font-bold">
            {sectionLabel}
            {moduleLabel}
            {section === 'listening' && exam === 'ielts' && st.phase === 'run' && ` · ${st.step < 4 ? `Part ${st.step + 1}` : 'Review'}`}
          </div>
        </div>
        {st.endsAt !== null || st.pausedLeft !== null ? <TimerDisplay seconds={shownLeft} dark /> : null}
        {st.flexible && st.phase === 'run' && (st.endsAt !== null || st.pausedLeft !== null) && (
          <ExamBtn onClick={togglePause}>{st.pausedLeft !== null ? <Play size={15} /> : <Pause size={15} />}</ExamBtn>
        )}
        <div className="flex items-center gap-2">{st.phase === 'run' && nav2}</div>
        <button onClick={() => setExitOpen(true)} className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label={t('Salir del examen', 'Exit test')}>
          <LogOut size={17} />
        </button>
      </header>
      <main className={cn('flex-1', st.pausedLeft !== null && 'pointer-events-none opacity-30 blur-sm')}>{body}</main>
      {st.pausedLeft !== null && (
        <div className="fixed inset-0 z-20 grid place-items-center">
          <div className="rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="font-bold">{t('Examen en pausa (modo flexible)', 'Test paused (flexible mode)')}</p>
            <Button className="mt-4" onClick={togglePause}>
              <Play size={15} /> {t('Reanudar', 'Resume')}
            </Button>
          </div>
        </div>
      )}
      {exam === 'ielts' && section === 'reading' && st.phase === 'run' && (
        <Palette
          mock={mock as IeltsMock}
          answers={st.answers}
          flags={st.flags}
          current={st.step}
          onGo={(k, itemId) => {
            patch({ step: k });
            setTimeout(() => document.getElementById(`q-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
          }}
        />
      )}
      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title={t('¿Salir del simulacro?', 'Leave the mock test?')}
        description={t('Tu progreso queda guardado y podrás retomarlo desde Simulacros. El tiempo sigue corriendo como en el examen real (salvo en modo flexible).', 'Your progress is saved and you can resume it from Mock tests. Time keeps running as in the real exam (except in flexible mode).')}
        confirm={t('Salir', 'Leave')}
        cancel={t('Seguir', 'Stay')}
        onConfirm={() => {
          if (st.flexible && st.endsAt) patch({ pausedLeft: left });
          nav('/exam');
        }}
      />
      <ConfirmDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title={t('¿Entregar esta sección?', 'Submit this section?')}
        description={t('No podrás volver a ella.', 'You will not be able to return to it.')}
        confirm={t('Entregar', 'Submit')}
        cancel={t('Cancelar', 'Cancel')}
        onConfirm={() => nextSection(st)}
      />
    </div>
  );
}

function toSaved(kind: string, o: SpeakingOutcome) {
  return {
    kind,
    itemScores: o.itemScores,
    band: o.band,
    responses: o.responses.map((r) => ({ prompt: r.prompt, transcript: r.transcript, durationSec: Math.round(r.durationSec), wpm: r.metrics.wpm, accuracy: r.accuracy, score: r.score })),
  };
}

function ExamBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn('inline-flex h-9 items-center gap-1 rounded-md px-3 text-[13.5px] font-semibold transition-colors', primary ? 'bg-white text-[#23272f] hover:bg-white/90' : 'bg-white/10 text-white hover:bg-white/20')}
    >
      {children}
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">{children}</div>;
}

/* ─────────── Introducciones de sección (instrucciones propias, no copiadas) ─────────── */

function SectionIntro({ exam, section, flexible, onBegin }: { exam: 'toefl' | 'ielts'; section: Skill; flexible: boolean; onBegin: () => void }) {
  const t = useT();
  const toefl: Record<Skill, string[]> = {
    reading: ['This section measures your ability to understand written English.', 'There are two modules. The second module depends on your performance in the first.', 'You can move back and forth between questions within a module.', 'Module 1: about 18 minutes · Module 2: about 9 minutes.'],
    listening: ['This section measures your ability to understand spoken English.', 'You will hear each recording only once. Questions appear after each recording.', 'You cannot return to previous questions.', 'There are two modules; the second depends on your performance in the first.'],
    writing: ['Build a Sentence: put the words in order to make a correct response (about 6 minutes).', 'Write an Email: about 7 minutes.', 'Write for an Academic Discussion: about 10 minutes.', 'When the time for a task ends, the test moves on automatically.'],
    speaking: ['Listen and Repeat: repeat each sentence exactly after you hear it once.', 'Take an Interview: answer 4 questions; you have about 45 seconds for each and no preparation time.', 'Your microphone will be used. Nothing is uploaded.'],
  };
  const ielts: Record<Skill, string[]> = {
    listening: ['There are four parts. You will hear each part ONCE only.', 'Before each part you have time to look at the questions.', 'Answer as you listen. At the end you have 2 minutes to check your answers.', 'Pay attention to the word limits. Spelling counts.'],
    reading: ['60 minutes, 3 passages, 40 questions. There is no extra time.', 'You can move between passages freely. Use the question palette at the bottom.', 'Pay attention to the word limits in each instruction.'],
    writing: ['60 minutes for both tasks. Manage your own time.', 'Task 1: at least 150 words (about 20 minutes).', 'Task 2: at least 250 words (about 40 minutes). Task 2 counts twice as much as Task 1.'],
    speaking: ['Part 1: questions about familiar topics.', 'Part 2: 1 minute to prepare with notes, then speak for up to 2 minutes.', 'Part 3: a discussion of more abstract questions.', 'Your microphone will be used. Nothing is uploaded.'],
  };
  const lines = (exam === 'toefl' ? toefl : ielts)[section];
  return (
    <Center>
      <div className="w-full max-w-xl text-left">
        <h1 className="text-[28px] font-bold">{SECTION_NAME[section]}</h1>
        <h2 className="mt-1 text-sm font-semibold tracking-wide text-[#4b5160] uppercase">Directions</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15.5px] leading-relaxed">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {flexible && <Notice tone="warn" className="mt-4">{t('Modo flexible: puedes pausar. Se indicará en los resultados.', 'Flexible mode: you can pause. This will be shown in the results.')}</Notice>}
        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={onBegin}>
            {t('Empezar sección', 'Begin section')} <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </Center>
  );
}

/* ─────────── TOEFL R/L ─────────── */

function ToeflRLPage({ ms, answers, setAnswer }: { ms: MockSet; answers: Answers; setAnswer: (id: string, v: Response) => void }) {
  const [audioDone, setAudioDone] = useState(false);
  switch (ms.bank) {
    case 'toefl.ctw':
      return (
        <div className="px-4 py-8">
          <CtwView set={ms.set as ToeflCtwSet} answers={answers} setAnswer={setAnswer} />
        </div>
      );
    case 'toefl.daily':
    case 'toefl.passage':
      return (
        <div className="p-4 lg:p-6">
          <ToeflReadingView set={ms.set as ToeflReadingSet} answers={answers} setAnswer={setAnswer} />
        </div>
      );
    default: {
      const s = ms.set as ToeflListeningSet;
      return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
          <AudioPlayer audio={s.audio} mode="exam" autoPlay context={s.context} onEnd={() => setAudioDone(true)} />
          {audioDone ? (
            s.questions.map((q, i) => <McqView key={q.id} item={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} number={s.questions.length > 1 ? `${i + 1}.` : undefined} />)
          ) : (
            <p className="text-center text-sm text-[#4b5160]">Listen. The question will appear after the recording.</p>
          )}
        </div>
      );
    }
  }
}

/* ─────────── IELTS Listening ─────────── */

function IeltsListeningQuestions({ part, answers, setAnswer }: { part: IeltsListeningPart; answers: Answers; setAnswer: (id: string, v: Response) => void }) {
  const start = Number(part.groups[0]?.items[0]?.id.replace(/\D/g, '')) || (part.part - 1) * 10 + 1;
  const numbers = useMemo(() => numberItems(part.groups, start), [part, start]);
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Part {part.part}</h2>
      <div className="space-y-8">
        {part.groups.map((g) => (
          <GroupView key={g.id} group={g} answers={answers} setAnswer={setAnswer} numbers={numbers} />
        ))}
      </div>
    </section>
  );
}

function IeltsListeningPartPage({ part, answers, setAnswer, onDone, last, flexible }: { part: IeltsListeningPart; answers: Answers; setAnswer: (id: string, v: Response) => void; onDone: () => void; last: boolean; flexible: boolean }) {
  const [phase, setPhase] = useState<'lead' | 'audio' | 'after'>('lead');
  const [count, setCount] = useState(IELTS_TIME.readingLead);
  useEffect(() => {
    if (phase === 'audio') return;
    if (count <= 0) {
      if (phase === 'lead') setPhase('audio');
      else onDone();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count]);
  const first = Number(part.groups[0]?.items[0]?.id.replace(/\D/g, '')) || (part.part - 1) * 10 + 1;
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-6">
      <div className="rounded-xl border border-[#d4d7dd] bg-[#f2f3f5] p-4">
        <div className="text-[15px] font-bold">Part {part.part}</div>
        {phase === 'lead' && (
          <p className="mt-1 text-sm">
            You now have some time to look at questions {first}–{first + 9}. The recording starts in <strong>{count}</strong> s.{' '}
            {flexible && (
              <button className="ml-2 underline" onClick={() => setCount(0)}>
                Start now
              </button>
            )}
          </p>
        )}
        {phase === 'audio' && <AudioPlayer audio={part.audio} mode="exam" autoPlay onEnd={() => { setPhase('after'); setCount(last ? 2 : IELTS_TIME.partGap); }} compact />}
        {phase === 'after' && (
          <p className="mt-1 text-sm">
            {last ? 'That is the end of the listening test.' : `You now have some time to check your answers to Part ${part.part}. The next part starts in ${count} s.`}
          </p>
        )}
      </div>
      <IeltsListeningQuestions part={part} answers={answers} setAnswer={setAnswer} />
    </div>
  );
}

/* ─────────── Paleta de preguntas IELTS Reading ─────────── */

function Palette({ mock, answers, flags, current, onGo }: { mock: IeltsMock; answers: Answers; flags: string[]; current: number; onGo: (passage: number, itemId: string) => void }) {
  let n = 1;
  return (
    <nav className="sticky bottom-0 z-20 border-t border-[#d4d7dd] bg-[#f2f3f5] px-3 py-2" aria-label="Question palette">
      <div className="scroll-thin flex gap-4 overflow-x-auto">
        {mock.reading.map((p, k) => (
          <div key={p.id} className="flex shrink-0 items-center gap-1">
            <span className={cn('mr-1 text-[12px] font-bold', current === k ? 'text-[#1f4e8c]' : 'text-[#4b5160]')}>P{k + 1}</span>
            {p.groups.flatMap((g) =>
              g.items.flatMap((it) => {
                const pts = it.kind === 'multi' ? it.answers.length : 1;
                const v = answers[`${p.id}::${it.id}`];
                const answered = v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
                const flagged = flags.includes(`${p.id}::${it.id}`);
                return Array.from({ length: pts }, (_, j) => {
                  const label = n++;
                  return (
                    <button
                      key={`${it.id}-${j}`}
                      onClick={() => onGo(k, it.id)}
                      className={cn('relative grid h-7 w-7 place-items-center rounded text-[11.5px] font-semibold', answered ? 'bg-[#1f4e8c] text-white' : 'border border-[#b6bac2] bg-white text-[#111318]')}
                      aria-label={`Question ${label}${answered ? ', answered' : ''}${flagged ? ', flagged' : ''}`}
                    >
                      {label}
                      {flagged && <Flag size={9} className="absolute -top-1 -right-1 fill-amber-500 text-amber-500" />}
                    </button>
                  );
                });
              }),
            )}
          </div>
        ))}
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-[#4b5160]">
          <CheckCircle2 size={12} /> {Object.keys(answers).filter((k) => mock.reading.some((p) => k.startsWith(p.id))).length}
        </span>
      </div>
    </nav>
  );
}
