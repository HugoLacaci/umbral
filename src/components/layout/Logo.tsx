/** Marca de Umbral: un umbral (dintel + jambas) con un escalón que sube hacia la meta. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent)" />
      <path d="M9 24V10.5h14V24" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 24v-4h3.2v-3.4h3.6" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={small ? 26 : 30} />
      <span className="font-display text-[19px] leading-none font-bold tracking-tight">
        Umbral
      </span>
    </span>
  );
}
