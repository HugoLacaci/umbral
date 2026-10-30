import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Dumbbell, Home, Timer, History, Settings, Moon, Sun, Languages, Flame } from 'lucide-react';
import { useApp, useUi, streak } from '@/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

export function useApplyTheme() {
  const { theme, exam } = useUi();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.exam = exam;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, exam]);
}

/** Cuenta minutos de estudio mientras la pestaña está visible en zonas de estudio. */
function useStudyClock() {
  const loc = useLocation();
  const addMinutes = useApp((s) => s.addMinutes);
  useEffect(() => {
    const studying = /^\/(study|practice|exam)/.test(loc.pathname);
    if (!studying) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') addMinutes(1);
    }, 60_000);
    return () => clearInterval(id);
  }, [loc.pathname, addMinutes]);
}

export function ExamSwitch({ compact }: { compact?: boolean }) {
  const { exam, setExam } = useUi();
  return (
    <div role="radiogroup" aria-label="Examen" className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      {(['toefl', 'ielts'] as const).map((e) => (
        <button
          key={e}
          role="radio"
          aria-checked={exam === e}
          onClick={() => setExam(e)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold tracking-wide transition-colors',
            exam === e ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', e === 'toefl' ? 'bg-toefl' : 'bg-ielts')} />
          {e === 'toefl' ? (compact ? 'TOEFL' : 'TOEFL iBT') : compact ? 'IELTS' : 'IELTS Ac.'}
        </button>
      ))}
    </div>
  );
}

export function PrefsButtons() {
  const { lang, setLang, theme, setTheme } = useUi();
  const t = useT();
  const dark = theme === 'dark' || (theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
        className="flex h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-muted hover:bg-surface-2 hover:text-ink"
        aria-label={t('Cambiar idioma de la interfaz', 'Change interface language')}
      >
        <Languages size={16} /> {lang.toUpperCase()}
      </button>
      <button
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        aria-label={dark ? t('Modo claro', 'Light mode') : t('Modo oscuro', 'Dark mode')}
      >
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </div>
  );
}

export function AppShell() {
  const t = useT();
  const activity = useApp((s) => s.activity);
  const xp = useApp((s) => s.xp);
  const name = useApp((s) => s.name);
  const days = streak(activity);
  useStudyClock();

  const nav = [
    { to: '/', icon: Home, label: t('Inicio', 'Home'), end: true },
    { to: '/study', icon: BookOpen, label: 'Study Room' },
    { to: '/practice', icon: Dumbbell, label: t('Práctica', 'Practice') },
    { to: '/exam', icon: Timer, label: t('Simulacros', 'Mock tests') },
    { to: '/history', icon: History, label: t('Historial', 'History') },
    { to: '/settings', icon: Settings, label: t('Ajustes', 'Settings') },
  ];

  return (
    <div className="app-bg min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {t('Saltar al contenido', 'Skip to content')}
      </a>
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-surface/70 px-3 py-4 backdrop-blur lg:flex">
        <NavLink to="/" className="mb-6 flex items-center gap-2 px-2">
          <Logo />
        </NavLink>
        <nav className="flex flex-col gap-0.5" aria-label={t('Navegación principal', 'Main navigation')}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <n.icon size={18} strokeWidth={2} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 font-semibold text-xp">
                <Flame size={15} /> {days} {t(days === 1 ? 'día' : 'días', days === 1 ? 'day' : 'days')}
              </span>
              <span className="font-mono text-[12px] text-muted">{xp} XP</span>
            </div>
            {name && <div className="mt-1 truncate text-xs text-faint">{name}</div>}
          </div>
          <div className="flex items-center justify-between px-1">
            <ExamSwitch compact />
          </div>
          <PrefsButtons />
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur lg:hidden">
        <NavLink to="/" aria-label="Umbral">
          <Logo small />
        </NavLink>
        <div className="flex items-center gap-1">
          <ExamSwitch compact />
          <PrefsButtons />
          <NavLink to="/settings" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label={t('Ajustes', 'Settings')}>
            <Settings size={17} />
          </NavLink>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-28 sm:px-6 lg:pl-[264px] lg:pr-8 lg:pb-12 xl:max-w-[1320px]">
        <Outlet />
      </main>

      {/* Navegación inferior móvil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label={t('Navegación principal', 'Main navigation')}
      >
        {nav.slice(0, 5).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-medium', isActive ? 'text-accent' : 'text-muted')}
          >
            <n.icon size={20} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
