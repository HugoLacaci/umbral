import * as React from 'react';
import * as DialogP from '@radix-ui/react-dialog';
import * as TabsP from '@radix-ui/react-tabs';
import * as SwitchP from '@radix-ui/react-switch';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ─────────── Button ─────────── */
type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'good';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong shadow-sm',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  outline: 'border border-line-strong text-ink hover:bg-surface-2 bg-surface',
  danger: 'bg-bad text-white hover:opacity-90',
  good: 'bg-good text-white hover:opacity-90',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
};

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ variant = 'primary', size = 'md', className, ...p }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center font-medium transition-[background,color,box-shadow,transform] active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100 select-none whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
      {...p}
    />
  ),
);
Button.displayName = 'Button';

/* ─────────── Card ─────────── */
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)} {...p} />;
}

export function SectionTitle({ children, action, sub }: { children: React.ReactNode; action?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-semibold">{children}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, eyebrow, actions }: { title: React.ReactNode; sub?: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1.5 text-xs font-semibold tracking-wide text-accent uppercase">{eyebrow}</div>}
        <h1 className="text-[28px] leading-tight font-bold sm:text-[34px]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/* ─────────── Badge ─────────── */
const badgeTones = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  good: 'bg-good-soft text-good',
  bad: 'bg-bad-soft text-bad',
  warn: 'bg-warn-soft text-warn',
};
export function Badge({ tone = 'neutral', className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold', badgeTones[tone], className)} {...p} />;
}

export function DifficultyBadge({ d, lang }: { d: 'easy' | 'medium' | 'hard'; lang: 'es' | 'en' }) {
  const map = { easy: ['good', 'Fácil', 'Easy'], medium: ['warn', 'Media', 'Medium'], hard: ['bad', 'Difícil', 'Hard'] } as const;
  const [tone, es, en] = map[d];
  return <Badge tone={tone}>{lang === 'es' ? es : en}</Badge>;
}

/* ─────────── Progress ─────────── */
export function ProgressBar({ value, max = 100, className, tone = 'accent', label }: { value: number; max?: number; className?: string; tone?: 'accent' | 'good' | 'bad' | 'warn'; label?: string }) {
  const p = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const bg = { accent: 'bg-accent', good: 'bg-good', bad: 'bg-bad', warn: 'bg-warn' }[tone];
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', bg)} style={{ width: `${p}%` }} />
    </div>
  );
}

/* ─────────── Dialog ─────────── */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <DialogP.Root open={open} onOpenChange={onOpenChange}>
      <DialogP.Portal>
        <DialogP.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <DialogP.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[88vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl focus:outline-none',
            wide ? 'max-w-3xl' : 'max-w-md',
          )}
        >
          <DialogP.Title className="pr-8 font-display text-xl font-bold">{title}</DialogP.Title>
          {description && <DialogP.Description className="mt-1.5 text-sm text-muted">{description}</DialogP.Description>}
          <div className="mt-4">{children}</div>
          <DialogP.Close className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Cerrar">
            <X size={18} />
          </DialogP.Close>
        </DialogP.Content>
      </DialogP.Portal>
    </DialogP.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  cancel,
  onConfirm,
  danger,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirm: string;
  cancel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {cancel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirm}
        </Button>
      </div>
    </Dialog>
  );
}

/* ─────────── Tabs ─────────── */
export const Tabs = TabsP.Root;
export function TabsList({ className, ...p }: TabsP.TabsListProps) {
  return <TabsP.List className={cn('scroll-thin flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2 p-1', className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: TabsP.TabsTriggerProps) {
  return (
    <TabsP.Trigger
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm',
        className,
      )}
      {...p}
    />
  );
}
export const TabsContent = TabsP.Content;

/* ─────────── Switch ─────────── */
export function Switch({ checked, onCheckedChange, label, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: React.ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <SwitchP.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-10 shrink-0 rounded-full bg-surface-3 transition-colors data-[state=checked]:bg-accent"
      >
        <SwitchP.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </SwitchP.Root>
    </label>
  );
}

/* ─────────── Misc ─────────── */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface px-1 font-mono text-[10.5px] text-muted">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

export function LoadingBlock() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-28" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mt-1.5 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">{icon}</div>}
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-muted">{label}</div>
        <div className="font-display text-2xl leading-tight font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-faint">{sub}</div>}
      </div>
    </div>
  );
}

export function Notice({ tone = 'neutral', icon, children, className }: { tone?: 'neutral' | 'warn' | 'bad' | 'good' | 'accent'; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const t = {
    neutral: 'bg-surface-2 text-muted border-line',
    warn: 'bg-warn-soft text-warn border-warn/30',
    bad: 'bg-bad-soft text-bad border-bad/30',
    good: 'bg-good-soft text-good border-good/30',
    accent: 'bg-accent-soft text-accent border-accent/25',
  }[tone];
  return (
    <div className={cn('flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13.5px] leading-relaxed', t, className)} role="note">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 [&_strong]:font-semibold">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 rounded-lg px-3 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
