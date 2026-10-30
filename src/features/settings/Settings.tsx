import { useEffect, useState } from 'react';
import { Download, Upload, KeyRound, Volume2, Mic, Trash2, Check, AlertTriangle, ExternalLink, Plus, X } from 'lucide-react';
import { useApp, useUi, type Requirement } from '@/store';
import { useT } from '@/i18n';
import { Button, Card, PageHeader, SectionTitle, Notice, Badge, ConfirmDialog, Segmented } from '@/components/ui';
import { accentCoverage, ACCENT_LABEL, say, ttsSupported } from '@/engine/tts';
import { sttSupported, recorderSupported } from '@/engine/speech';
import { SKILLS, type Skill } from '@/engine/plan';
import type { Accent } from '@/content/schema';

export default function SettingsPage() {
  const t = useT();
  const ui = useUi();
  const app = useApp();
  const exam = ui.exam;
  const profile = app.profiles[exam];
  const [key, setKey] = useState(app.geminiKey);
  const [cover, setCover] = useState<{ accent: Accent; count: number }[]>([]);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const bands = exam === 'toefl' ? [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6] : [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

  useEffect(() => {
    accentCoverage().then(setCover);
  }, []);

  const exportFile = () => {
    const blob = new Blob([app.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `umbral-progreso-${(app.name || 'perfil').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importFile = async (f: File) => {
    try {
      app.importData(await f.text());
      setMsg({ tone: 'good', text: t('Progreso importado.', 'Progress imported.') });
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as Error).message });
    }
  };

  const setReq = (reqs: Requirement[]) => app.updateProfile(exam, { requirements: reqs });

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow={t('Ajustes', 'Settings')} title={t('Perfil y preferencias', 'Profile & preferences')} />
      {msg && (
        <Notice tone={msg.tone} className="mb-4">
          {msg.text}
        </Notice>
      )}

      <Card className="p-5">
        <SectionTitle>{t('Perfil', 'Profile')}</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">{t('Nombre', 'Name')}</span>
            <input value={app.name} onChange={(e) => app.set({ name: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-line-strong bg-surface px-3 outline-none focus:border-accent" />
          </label>
          <label className="text-sm">
            <span className="font-medium">{t('Minutos al día', 'Minutes per day')}</span>
            <input type="number" min={15} max={300} step={5} value={app.minutesPerDay} onChange={(e) => app.set({ minutesPerDay: +e.target.value || 60 })} className="mt-1 h-10 w-full rounded-xl border border-line-strong bg-surface px-3 outline-none focus:border-accent" />
          </label>
          <label className="text-sm">
            <span className="font-medium">
              {t('Fecha del examen', 'Exam date')} ({exam.toUpperCase()})
            </span>
            <input
              type="date"
              value={profile.examDate ? new Date(profile.examDate).toISOString().slice(0, 10) : ''}
              onChange={(e) => app.updateProfile(exam, { examDate: e.target.value ? new Date(e.target.value + 'T09:00:00').getTime() : null })}
              className="mt-1 h-10 w-full rounded-xl border border-line-strong bg-surface px-3 outline-none focus:border-accent"
            />
          </label>
          <div className="text-sm">
            <span className="font-medium">{t('Tema', 'Theme')}</span>
            <Segmented
              className="mt-1 flex"
              value={ui.theme}
              onChange={ui.setTheme}
              options={[
                { value: 'light', label: t('Claro', 'Light') },
                { value: 'dark', label: t('Oscuro', 'Dark') },
                { value: 'system', label: t('Sistema', 'System') },
              ]}
            />
          </div>
        </div>
        <div className="mt-5">
          <div className="text-sm font-medium">{t('Nota objetivo', 'Target score')}</div>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <BandField label={t('Global', 'Overall')} value={profile.overallTarget} bands={bands} onChange={(v) => app.updateProfile(exam, { overallTarget: v })} />
            {SKILLS.map((s) => (
              <BandField key={s} label={s} value={profile.targets[s]} bands={bands} onChange={(v) => app.updateProfile(exam, { targets: { ...profile.targets, [s]: v } })} />
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <SectionTitle sub={t('Se usan en los informes de simulacro («SJTU: cumples R y L, te falta 0.5 en W»).', 'Used in mock reports ("SJTU: you meet R and L, 0.5 short in W").')}>{t('Requisitos de universidades', 'University requirements')}</SectionTitle>
        <div className="space-y-3">
          {profile.requirements.map((r, i) => (
            <div key={r.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-line p-3">
              <label className="text-xs">
                {t('Nombre', 'Name')}
                <input value={r.name} onChange={(e) => setReq(profile.requirements.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="mt-1 block h-9 w-40 rounded-lg border border-line-strong bg-surface px-2 text-sm" />
              </label>
              <BandField small label={t('Global', 'Overall')} value={r.overall} bands={bands} onChange={(v) => setReq(profile.requirements.map((x, j) => (j === i ? { ...x, overall: v } : x)))} />
              {SKILLS.map((s) => (
                <BandField
                  key={s}
                  small
                  label={s.slice(0, 1).toUpperCase()}
                  value={r.sections[s] ?? 0}
                  bands={[0, ...bands]}
                  onChange={(v) => setReq(profile.requirements.map((x, j) => (j === i ? { ...x, sections: { ...x.sections, [s]: v || undefined } } : x)))}
                />
              ))}
              <button onClick={() => setReq(profile.requirements.filter((_, j) => j !== i))} className="mb-1 rounded-lg p-2 text-faint hover:text-bad" aria-label={t('Quitar', 'Remove')}>
                <X size={15} />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setReq([...profile.requirements, { id: String(Date.now()), name: t('Nueva', 'New'), overall: profile.overallTarget, sections: {} }])}>
            <Plus size={14} /> {t('Añadir requisito', 'Add requirement')}
          </Button>
          <p className="text-xs text-faint">{t('0 = sin mínimo en esa sección.', '0 = no minimum for that section.')}</p>
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <SectionTitle sub={t('Somos dos personas con navegadores distintos: exporta tu progreso a un archivo JSON y vuelve a importarlo donde quieras.', 'Export your progress to a JSON file and import it elsewhere.')}>{t('Copia de seguridad', 'Backup')}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportFile}>
            <Download size={16} /> {t('Exportar progreso', 'Export progress')}
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2">
            <Upload size={16} /> {t('Importar', 'Import')}
            <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
        </div>
        <p className="mt-2 text-xs text-faint">{t('La API key de Gemini no se incluye en la exportación.', 'The Gemini API key is not included in the export.')}</p>
      </Card>

      <Card className="mt-5 p-5">
        <SectionTitle sub={t('Opcional. Consigue una gratis en Google AI Studio. Se guarda sólo en este navegador y nunca sale de él salvo hacia la API de Google.', 'Optional. Get a free one at Google AI Studio. Stored only in this browser and only sent to Google’s API.')}>
          <span className="flex items-center gap-2">
            <KeyRound size={18} className="text-accent" /> {t('Corrección con IA (Gemini)', 'AI feedback (Gemini)')}
          </span>
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…" autoComplete="off" className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 font-mono text-sm outline-none focus:border-accent" aria-label="Gemini API key" />
          <Button onClick={() => app.set({ geminiKey: key.trim() })} disabled={key.trim() === app.geminiKey}>
            <Check size={15} /> {t('Guardar', 'Save')}
          </Button>
          {app.geminiKey && (
            <Button
              variant="ghost"
              onClick={() => {
                setKey('');
                app.set({ geminiKey: '' });
              }}
            >
              {t('Borrar', 'Remove')}
            </Button>
          )}
        </div>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          aistudio.google.com/app/apikey <ExternalLink size={11} />
        </a>
      </Card>

      <Card className="mt-5 p-5">
        <SectionTitle sub={t('El Listening usa las voces de tu navegador/sistema. Para variedad de acentos, Chrome y Edge suelen ofrecer más voces.', 'Listening uses your browser/OS voices. Chrome and Edge usually offer more accents.')}>{t('Voz y micrófono', 'Voice & microphone')}</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <Badge tone={ttsSupported() ? 'good' : 'bad'}>
            <Volume2 size={12} /> {t('Síntesis de voz', 'Speech synthesis')}: {ttsSupported() ? 'OK' : t('no disponible', 'unavailable')}
          </Badge>
          <Badge tone={sttSupported() ? 'good' : 'warn'}>
            <Mic size={12} /> {t('Reconocimiento de voz', 'Speech recognition')}: {sttSupported() ? 'OK' : t('no disponible (usa Chrome/Edge)', 'unavailable (use Chrome/Edge)')}
          </Badge>
          <Badge tone={recorderSupported() ? 'good' : 'bad'}>
            <Mic size={12} /> {t('Grabación', 'Recording')}: {recorderSupported() ? 'OK' : t('no disponible', 'unavailable')}
          </Badge>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {cover.map((c) => (
            <li key={c.accent} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
              <span>
                {ACCENT_LABEL[c.accent]} <span className="font-mono text-xs text-faint">{c.accent}</span>
              </span>
              <span className="flex items-center gap-2">
                {c.count ? <Badge tone="good">{c.count}</Badge> : <Badge tone="warn"><AlertTriangle size={11} /> 0</Badge>}
                <button onClick={() => say('Good morning. The lecture will start in the main hall at ten.', c.accent)} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label={`${t('Probar', 'Test')} ${c.accent}`}>
                  <Volume2 size={15} />
                </button>
              </span>
            </li>
          ))}
        </ul>
        {cover.some((c) => !c.count) && <p className="mt-2 text-xs text-warn">{t('Faltan voces para algunos acentos: se usará el acento más parecido disponible. En Windows puedes añadir voces en Configuración → Hora e idioma → Voz.', 'Some accents have no voice: the closest available one will be used. On Windows, add voices in Settings → Time & language → Speech.')}</p>}
      </Card>

      <Card className="mt-5 border-bad/30 p-5">
        <SectionTitle>{t('Zona peligrosa', 'Danger zone')}</SectionTitle>
        <Button variant="danger" onClick={() => setResetOpen(true)}>
          <Trash2 size={15} /> {t('Borrar todo el progreso', 'Delete all progress')}
        </Button>
      </Card>
      <p className="mt-6 text-xs text-faint">
        {t('Umbral no está afiliado a ETS, British Council, IDP ni Cambridge. TOEFL e IELTS son marcas de sus respectivos propietarios. Todo el material es original; las notas son estimaciones orientativas.', 'Umbral is not affiliated with ETS, British Council, IDP or Cambridge. TOEFL and IELTS are trademarks of their owners. All material is original; scores are estimates.')}
      </p>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        danger
        title={t('¿Borrar todo?', 'Delete everything?')}
        description={t('Se borrarán intentos, flashcards y ajustes de este navegador. Exporta antes si quieres conservarlo.', 'Attempts, flashcards and settings in this browser will be deleted. Export first to keep them.')}
        confirm={t('Borrar', 'Delete')}
        cancel={t('Cancelar', 'Cancel')}
        onConfirm={() => app.reset()}
      />
    </div>
  );
}

function BandField({ label, value, bands, onChange, small }: { label: string; value: number; bands: number[]; onChange: (v: number) => void; small?: boolean }) {
  return (
    <label className="text-xs capitalize">
      {label}
      <select value={value} onChange={(e) => onChange(+e.target.value)} className={`mt-1 block rounded-lg border border-line-strong bg-surface px-2 font-mono text-sm ${small ? 'h-9 w-16' : 'h-10 w-full'}`}>
        {bands.map((b) => (
          <option key={b} value={b}>
            {b === 0 ? '—' : b.toFixed(1)}
          </option>
        ))}
      </select>
    </label>
  );
}

export type { Skill };
