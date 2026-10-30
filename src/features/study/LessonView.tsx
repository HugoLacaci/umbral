import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, CheckCircle2, Circle, Clock, Dumbbell } from 'lucide-react';
import { useBank, BANK_META } from '@/content';
import { useApp } from '@/store';
import { useT } from '@/i18n';
import { Button, LoadingBlock, Badge, Notice } from '@/components/ui';
import { Markdown } from '@/components/ui/Markdown';

export default function LessonView() {
  const t = useT();
  const { id } = useParams();
  const { data } = useBank('study.lessons');
  const { studied, bookmarks, toggle } = useApp();
  if (!data) return <LoadingBlock />;
  const l = data.find((x) => x.id === id);
  if (!l) return <Notice tone="bad">{t('Lección no encontrada.', 'Lesson not found.')}</Notice>;
  const done = studied.includes(l.id);
  const marked = bookmarks.includes(l.id);
  const practice = BANK_META.find((b) => b.lesson === l.id);
  const sameSection = data.filter((x) => x.exam === l.exam && x.section === l.section);
  const i = sameSection.findIndex((x) => x.id === l.id);
  const next = sameSection[i + 1];

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/study/guides" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {t('Guías', 'Guides')}
      </Link>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="accent">{l.exam === 'toefl' ? 'TOEFL iBT' : l.exam === 'ielts' ? 'IELTS' : 'TOEFL · IELTS'}</Badge>
        <Badge>{l.section}</Badge>
        <span className="flex items-center gap-1 text-xs text-faint">
          <Clock size={12} /> {l.minutes} min
        </span>
      </div>
      <h1 className="text-[30px] leading-tight font-bold sm:text-[36px]">{l.title}</h1>
      <p className="mt-2 text-[16px] text-muted">{l.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={done ? 'good' : 'outline'} size="sm" onClick={() => toggle('studied', l.id)}>
          {done ? <CheckCircle2 size={15} /> : <Circle size={15} />} {done ? t('Estudiado', 'Studied') : t('Marcar como estudiado', 'Mark as studied')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toggle('bookmarks', l.id)} aria-pressed={marked}>
          <Bookmark size={15} className={marked ? 'fill-accent text-accent' : ''} /> {marked ? t('Guardado', 'Saved') : t('Marcador', 'Bookmark')}
        </Button>
        {practice && (
          <Link to={`/practice/${practice.key}`}>
            <Button size="sm">
              <Dumbbell size={15} /> {t('Practicar', 'Practise')}: {practice.title}
            </Button>
          </Link>
        )}
      </div>
      <hr className="my-6 border-line" />
      <Markdown source={l.body} />
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {!done ? (
          <Button onClick={() => toggle('studied', l.id)}>
            <CheckCircle2 size={16} /> {t('He terminado esta lección', "I've finished this lesson")}
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-good">
            <CheckCircle2 size={16} /> {t('Lección estudiada', 'Lesson studied')}
          </span>
        )}
        {next && (
          <Link to={`/study/lesson/${next.id}`} className="text-sm font-medium text-accent hover:underline">
            {t('Siguiente', 'Next')}: {next.title} →
          </Link>
        )}
      </div>
    </article>
  );
}
