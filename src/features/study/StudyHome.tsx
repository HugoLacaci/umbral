import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Search, BookOpen, Layers, PenTool, Link2, PlayCircle, ExternalLink, Bookmark, CheckCircle2, Clock, Eye, AlertTriangle, StickyNote } from 'lucide-react';
import { useBank } from '@/content';
import type { Deck, Lesson, Video } from '@/content/schema';
import { useApp, useUi } from '@/store';
import { useT } from '@/i18n';
import { Card, PageHeader, Tabs, TabsList, TabsTrigger, TabsContent, Badge, LoadingBlock, ProgressBar, EmptyState, Segmented } from '@/components/ui';
import { isDue, mastery } from '@/engine/srs';
import { cn } from '@/lib/cn';

const SECTION_ORDER = ['general', 'reading', 'listening', 'writing', 'speaking'] as const;
const SECTION_LABEL: Record<string, { es: string; en: string }> = {
  general: { es: 'General', en: 'General' },
  overview: { es: 'Visión general', en: 'Overview' },
  reading: { es: 'Reading', en: 'Reading' },
  listening: { es: 'Listening', en: 'Listening' },
  writing: { es: 'Writing', en: 'Writing' },
  speaking: { es: 'Speaking', en: 'Speaking' },
  vocabulary: { es: 'Vocabulario', en: 'Vocabulary' },
  grammar: { es: 'Gramática', en: 'Grammar' },
};

export default function StudyHome() {
  const t = useT();
  const { tab = 'guides' } = useParams();
  const nav = useNavigate();
  return (
    <div>
      <PageHeader eyebrow="Study Room" title={t('Aprende el examen por dentro', 'Learn the exam inside out')} sub={t('Guías de cada tarea, vocabulario con repetición espaciada, gramática que sube nota, conectores y vídeos seleccionados.', 'Task guides, spaced-repetition vocabulary, score-raising grammar, connectors and curated videos.')} />
      <Tabs value={tab} onValueChange={(v) => nav(`/study/${v}`)}>
        <TabsList className="mb-5 w-full sm:w-auto">
          <TabsTrigger value="guides">
            <BookOpen size={15} /> {t('Guías', 'Guides')}
          </TabsTrigger>
          <TabsTrigger value="vocab">
            <Layers size={15} /> {t('Vocabulario', 'Vocabulary')}
          </TabsTrigger>
          <TabsTrigger value="grammar">
            <PenTool size={15} /> {t('Gramática', 'Grammar')}
          </TabsTrigger>
          <TabsTrigger value="connectors">
            <Link2 size={15} /> {t('Conectores', 'Connectors')}
          </TabsTrigger>
          <TabsTrigger value="videos">
            <PlayCircle size={15} /> {t('Vídeos', 'Videos')}
          </TabsTrigger>
          <TabsTrigger value="resources">
            <ExternalLink size={15} /> {t('Recursos oficiales', 'Official resources')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="guides">
          <Guides />
        </TabsContent>
        <TabsContent value="vocab">
          <Vocab />
        </TabsContent>
        <TabsContent value="grammar">
          <Grammar />
        </TabsContent>
        <TabsContent value="connectors">
          <Connectors />
        </TabsContent>
        <TabsContent value="videos">
          <Videos />
        </TabsContent>
        <TabsContent value="resources">
          <Resources />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative mb-4 block max-w-md">
      <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm outline-none focus:border-accent" aria-label={placeholder} />
    </label>
  );
}

/* ─────────── Guías ─────────── */

function Guides() {
  const t = useT();
  const exam = useUi((s) => s.exam);
  const { data } = useBank('study.lessons');
  const { studied, bookmarks } = useApp();
  const [q, setQ] = useState('');
  const [onlyMarked, setOnlyMarked] = useState(false);
  const lessons = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data ?? []).filter((l) => (l.exam === exam || l.exam === 'both') && (!onlyMarked || bookmarks.includes(l.id)) && (!n || `${l.title} ${l.summary} ${l.body} ${l.tags.join(' ')}`.toLowerCase().includes(n)));
  }, [data, exam, q, onlyMarked, bookmarks]);
  if (!data) return <LoadingBlock />;
  const all = data.filter((l) => l.exam === exam || l.exam === 'both');
  const done = all.filter((l) => studied.includes(l.id)).length;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder={t('Buscar en las guías…', 'Search guides…')} />
        <button onClick={() => setOnlyMarked((v) => !v)} aria-pressed={onlyMarked} className={cn('mb-4 inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm', onlyMarked ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted')}>
          <Bookmark size={15} /> {t('Marcadores', 'Bookmarks')}
        </button>
        <div className="mb-4 flex min-w-48 flex-1 items-center gap-2 text-sm text-muted">
          <ProgressBar value={done} max={all.length} />
          <span className="shrink-0 font-mono text-xs">
            {done}/{all.length}
          </span>
        </div>
      </div>
      {lessons.length === 0 && <EmptyState icon={<Search size={22} />} title={t('Nada por aquí', 'Nothing here')}>{t('Prueba con otra búsqueda.', 'Try another search.')}</EmptyState>}
      <div className="space-y-7">
        {SECTION_ORDER.map((sec) => {
          const ls = lessons.filter((l) => l.section === sec);
          if (!ls.length) return null;
          return (
            <section key={sec}>
              <h2 className="mb-2.5 text-[15px] font-semibold text-muted">{t.x(SECTION_LABEL[sec])}</h2>
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {ls.map((l) => (
                  <LessonCard key={l.id} l={l} studied={studied.includes(l.id)} marked={bookmarks.includes(l.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LessonCard({ l, studied, marked }: { l: Lesson; studied: boolean; marked: boolean }) {
  return (
    <Link to={`/study/lesson/${l.id}`}>
      <Card className="h-full p-4 transition-colors hover:border-accent">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-sans text-[14.5px] leading-snug font-semibold tracking-normal">{l.title}</h3>
          <span className="flex shrink-0 items-center gap-1">
            {marked && <Bookmark size={14} className="fill-accent text-accent" />}
            {studied && <CheckCircle2 size={15} className="text-good" />}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] text-muted">{l.summary}</p>
        <div className="mt-2 flex items-center gap-1 text-[11.5px] text-faint">
          <Clock size={12} /> {l.minutes} min
        </div>
      </Card>
    </Link>
  );
}

/* ─────────── Vocabulario ─────────── */

const CAT_LABEL: Record<Deck['category'], { es: string; en: string }> = {
  awl: { es: 'Academic Word List', en: 'Academic Word List' },
  topic: { es: 'Vocabulario temático (Writing y Speaking)', en: 'Topic vocabulary (Writing & Speaking)' },
  graph: { es: 'Describir gráficos (IELTS Task 1)', en: 'Describing graphs (IELTS Task 1)' },
  phrasal: { es: 'Phrasal verbs para Speaking', en: 'Phrasal verbs for Speaking' },
  idiom: { es: 'Idioms (¡con cuidado!)', en: 'Idioms (use with care!)' },
  campus: { es: 'Vida universitaria (clave en TOEFL)', en: 'Campus life (key for TOEFL)' },
  'false-friend': { es: 'Falsos amigos', en: 'False friends' },
  collocation: { es: 'Colocaciones', en: 'Collocations' },
  preposition: { es: 'Preposiciones traicioneras', en: 'Tricky prepositions' },
};
const CAT_ORDER: Deck['category'][] = ['awl', 'topic', 'graph', 'campus', 'false-friend', 'collocation', 'preposition', 'phrasal', 'idiom'];

function Vocab() {
  const t = useT();
  const { data } = useBank('study.decks');
  const srs = useApp((s) => s.srs);
  const [q, setQ] = useState('');
  if (!data) return <LoadingBlock />;
  const now = Date.now();
  const totalDue = data.reduce((s, d) => s + d.cards.filter((c) => srs[c.id] && isDue(srs[c.id], now)).length, 0);
  const n = q.trim().toLowerCase();
  const hits = n ? data.flatMap((d) => d.cards.filter((c) => `${c.term} ${c.es ?? ''} ${c.definition}`.toLowerCase().includes(n)).map((c) => ({ c, d }))).slice(0, 40) : [];
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder={t('Buscar una palabra…', 'Search a word…')} />
        {totalDue > 0 && (
          <Link to="/study/deck/__due" className="mb-4">
            <Badge tone="warn" className="h-10 px-3 text-sm">
              {totalDue} {t('tarjetas para repasar hoy', 'cards due today')} →
            </Badge>
          </Link>
        )}
      </div>
      {n ? (
        <div className="grid gap-2 md:grid-cols-2">
          {hits.map(({ c, d }) => (
            <Link key={c.id} to={`/study/deck/${d.id}`}>
              <Card className="p-3 hover:border-accent">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{c.term}</span>
                  <span className="text-xs text-faint">{d.title}</span>
                </div>
                <p className="text-[13px] text-muted">{c.definition}</p>
              </Card>
            </Link>
          ))}
          {!hits.length && <p className="text-sm text-muted">{t('Sin resultados.', 'No results.')}</p>}
        </div>
      ) : (
        <div className="space-y-7">
          {CAT_ORDER.map((cat) => {
            const decks = data.filter((d) => d.category === cat).sort((a, b) => (a.sublist ?? 0) - (b.sublist ?? 0));
            if (!decks.length) return null;
            return (
              <section key={cat}>
                <h2 className="mb-2.5 text-[15px] font-semibold text-muted">{t.x(CAT_LABEL[cat])}</h2>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {decks.map((d) => {
                    const learned = d.cards.filter((c) => mastery(srs[c.id]) !== 'new').length;
                    const due = d.cards.filter((c) => srs[c.id] && isDue(srs[c.id], now)).length;
                    return (
                      <Link key={d.id} to={`/study/deck/${d.id}`}>
                        <Card className="h-full p-3.5 transition-colors hover:border-accent">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[14px] font-semibold">{t.lang === 'es' ? d.titleEs : d.title}</span>
                            {due > 0 && <Badge tone="warn">{due}</Badge>}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <ProgressBar value={learned} max={d.cards.length} />
                            <span className="shrink-0 font-mono text-[11px] text-faint">
                              {learned}/{d.cards.length}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────── Gramática ─────────── */

function Grammar() {
  const t = useT();
  const { data } = useBank('study.grammar');
  const studied = useApp((s) => s.studied);
  if (!data) return <LoadingBlock />;
  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-muted">{t('Las estructuras que suben la nota de Writing y Speaking: explicación, ejemplos, errores típicos de hispanohablantes y ejercicios autocorregibles.', 'Structures that raise Writing and Speaking scores: explanation, examples, typical Spanish-speaker errors and self-marking exercises.')}</p>
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {data.map((g) => (
          <Link key={g.id} to={`/study/grammar-topic/${g.id}`}>
            <Card className="h-full p-4 transition-colors hover:border-accent">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{t.lang === 'es' ? g.titleEs : g.title}</span>
                <span className="flex items-center gap-1">
                  <Badge tone={g.level === 'C1' ? 'bad' : g.level === 'B2' ? 'warn' : 'good'}>{g.level}</Badge>
                  {studied.includes(`grammar:${g.id}`) && <CheckCircle2 size={15} className="text-good" />}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] text-muted">{g.why}</p>
              <div className="mt-2 text-[11.5px] text-faint">
                {g.exercises.length} {t('ejercicios', 'exercises')}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Conectores ─────────── */

function Connectors() {
  const t = useT();
  const { data } = useBank('study.connectors');
  const [reg, setReg] = useState<'all' | 'formal' | 'neutral' | 'informal'>('all');
  if (!data) return <LoadingBlock />;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={reg}
          onChange={setReg}
          options={[
            { value: 'all', label: t('Todos', 'All') },
            { value: 'formal', label: 'Formal' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'informal', label: 'Informal' },
          ]}
        />
        <span className="text-xs text-muted">{t('Formal: ensayos IELTS y discusión TOEFL · Informal: Speaking y emails a conocidos.', 'Formal: IELTS essays & TOEFL discussion · Informal: Speaking and emails to friends.')}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.map((g) => (
          <Card key={g.id} className="p-4">
            <h3 className="mb-2 font-sans text-[15px] font-semibold tracking-normal">
              {t.lang === 'es' ? g.titleEs : g.title} <span className="text-xs font-normal text-faint">· {g.function}</span>
            </h3>
            <ul className="divide-y divide-line">
              {g.items
                .filter((i) => reg === 'all' || i.register === reg)
                .map((i) => (
                  <li key={i.phrase} className="py-2 text-[13.5px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{i.phrase}</span>
                      <Badge tone={i.register === 'formal' ? 'accent' : i.register === 'informal' ? 'warn' : 'neutral'}>{i.register}</Badge>
                      <code className="text-[11.5px] text-faint">{i.pattern}</code>
                    </div>
                    <p className="mt-0.5 font-serif text-muted italic">{i.example}</p>
                    {i.warning && (
                      <p className="mt-0.5 flex gap-1 text-[12.5px] text-warn">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {i.warning}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Vídeos ─────────── */

function Videos() {
  const t = useT();
  const exam = useUi((s) => s.exam);
  const { data } = useBank('study.videos');
  const { videosWatched, videoNotes, toggle, set } = useApp();
  const [section, setSection] = useState('all');
  const [playing, setPlaying] = useState<string | null>(null);
  if (!data) return <LoadingBlock />;
  const list = data.filter((v) => (v.exam === exam || v.exam === 'both') && (section === 'all' || v.section === section));
  const sections = [...new Set(data.filter((v) => v.exam === exam || v.exam === 'both').map((v) => v.section))];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['all', ...sections].map((s) => (
          <button key={s} onClick={() => setSection(s)} aria-pressed={section === s} className={cn('h-8 rounded-lg border px-3 text-[13px] font-medium', section === s ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink')}>
            {s === 'all' ? t('Todos', 'All') : t.x(SECTION_LABEL[s] ?? { es: s, en: s })}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">
          {list.filter((v) => videosWatched.includes(v.id)).length}/{list.length} {t('vistos', 'watched')}
        </span>
      </div>
      {exam === 'toefl' && <p className="mb-4 text-xs text-muted">{t('Sólo vídeos sobre el formato de 2026 (verificados). Los del formato antiguo llevan la etiqueta «formato antiguo».', 'Only videos about the 2026 format (verified). Old-format videos are labelled.')}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((v) => (
          <VideoCard
            key={v.id}
            v={v}
            playing={playing === v.id}
            onPlay={() => setPlaying(v.id)}
            watched={videosWatched.includes(v.id)}
            onWatched={() => toggle('videosWatched', v.id)}
            note={videoNotes[v.id] ?? ''}
            onNote={(n) => set({ videoNotes: { ...useApp.getState().videoNotes, [v.id]: n } })}
          />
        ))}
      </div>
    </div>
  );
}

function VideoCard({ v, playing, onPlay, watched, onWatched, note, onNote }: { v: Video; playing: boolean; onPlay: () => void; watched: boolean; onWatched: () => void; note: string; onNote: (n: string) => void }) {
  const t = useT();
  const [showNote, setShowNote] = useState(!!note);
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`}
            title={v.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button onClick={onPlay} className="group absolute inset-0" aria-label={`${t('Reproducir', 'Play')}: ${v.title}`}>
            <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
            <PlayCircle size={52} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg" />
          </button>
        )}
      </div>
      <div className="p-3.5">
        <div className="mb-1 flex flex-wrap gap-1.5">
          <Badge>{v.channel.trim()}</Badge>
          {v.format === 'legacy' && <Badge tone="bad">{t('formato antiguo', 'old format')}</Badge>}
          {v.format === '2026' && <Badge tone="good">2026</Badge>}
        </div>
        <h3 className="font-sans text-[14px] leading-snug font-semibold tracking-normal">{v.title}</h3>
        {v.note && <p className="mt-1 text-[12.5px] text-muted">{v.note}</p>}
        <div className="mt-2.5 flex items-center gap-2">
          <button onClick={onWatched} aria-pressed={watched} className={cn('inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium', watched ? 'bg-good-soft text-good' : 'text-muted hover:bg-surface-2')}>
            {watched ? <CheckCircle2 size={14} /> : <Eye size={14} />} {watched ? t('Visto', 'Watched') : t('Marcar visto', 'Mark watched')}
          </button>
          <button onClick={() => setShowNote((s) => !s)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] text-muted hover:bg-surface-2">
            <StickyNote size={14} /> {t('Notas', 'Notes')}
          </button>
        </div>
        {showNote && <textarea value={note} onChange={(e) => onNote(e.target.value)} placeholder={t('Tus notas sobre este vídeo…', 'Your notes on this video…')} className="mt-2 h-20 w-full rounded-lg border border-line bg-surface-2 p-2 text-[13px] outline-none focus:border-accent" />}
      </div>
    </Card>
  );
}

/* ─────────── Recursos ─────────── */

function Resources() {
  const t = useT();
  const exam = useUi((s) => s.exam);
  const { data } = useBank('study.resources');
  if (!data) return <LoadingBlock />;
  const list = data.filter((r) => r.exam === exam || r.exam === 'both');
  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-muted">{t('Material oficial y gratuito. Úsalo para contrastar: los tests oficiales son la mejor referencia de nivel real.', 'Free official material. Use it to calibrate: official tests are the best reference for the real level.')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((r) => (
          <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
            <Card className="h-full p-4 transition-colors hover:border-accent">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{r.title}</span>
                <ExternalLink size={15} className="shrink-0 text-faint" />
              </div>
              <Badge className="mt-1">{r.provider}</Badge>
              <p className="mt-1.5 text-[13px] text-muted">{r.description}</p>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
