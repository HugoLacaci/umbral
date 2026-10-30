import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { ArrowRight, ArrowDown, RotateCw } from 'lucide-react';
import type { Visual } from '@/content/schema';
import { DiagramView } from '@/components/questions/Items';

/** Paleta sobria y distinguible en claro y oscuro (estilo informe de examen). */
const SERIES = ['#2f5fb3', '#d4703a', '#3e9b6a', '#8a5bb8', '#c2a23a', '#4a9bb5', '#b8505f', '#6f7787'];

const axisTick = { fill: 'var(--muted)', fontSize: 11.5 };
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 };

type Base = Exclude<Visual, { type: 'mixed' }>;

function Chart({ v }: { v: Base }) {
  switch (v.type) {
    case 'line': {
      const data = v.categories.map((c, i) => Object.fromEntries([['c', c], ...v.series.map((s) => [s.name, s.values[i]])]));
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis dataKey="c" tick={axisTick} label={v.xLabel ? { value: v.xLabel, position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 11 } : undefined} height={v.xLabel ? 40 : 30} />
            <YAxis tick={axisTick} label={v.yLabel ? { value: v.yLabel, angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 11 } : undefined} width={v.yLabel ? 60 : 44} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {v.series.map((s, i) => (
              <Line key={s.name} type="linear" dataKey={s.name} stroke={SERIES[i % SERIES.length]} strokeWidth={2.2} dot={{ r: 3 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    case 'bar': {
      const data = v.categories.map((c, i) => Object.fromEntries([['c', c], ...v.series.map((s) => [s.name, s.values[i]])]));
      const h = v.horizontal ? Math.max(260, v.categories.length * v.series.length * 18 + 80) : 300;
      return (
        <ResponsiveContainer width="100%" height={h}>
          <BarChart data={data} layout={v.horizontal ? 'vertical' : 'horizontal'} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            {v.horizontal ? (
              <>
                <XAxis type="number" tick={axisTick} />
                <YAxis type="category" dataKey="c" tick={axisTick} width={96} />
              </>
            ) : (
              <>
                <XAxis dataKey="c" tick={axisTick} label={v.xLabel ? { value: v.xLabel, position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 11 } : undefined} height={v.xLabel ? 40 : 30} />
                <YAxis tick={axisTick} label={v.yLabel ? { value: v.yLabel, angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 11 } : undefined} width={v.yLabel ? 60 : 44} />
              </>
            )}
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
            {v.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {v.series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} fill={SERIES[i % SERIES.length]} isAnimationActive={false} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }
    case 'pie':
      return (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${v.pies.length > 2 ? 200 : 240}px, 1fr))` }}>
          {v.pies.map((p) => (
            <figure key={p.title} className="text-center">
              <figcaption className="text-[13px] font-semibold">{p.title}</figcaption>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={p.slices} dataKey="value" nameKey="label" outerRadius="70%" isAnimationActive={false} stroke="var(--surface)">
                    {p.slices.map((_, i) => (
                      <Cell key={i} fill={SERIES[i % SERIES.length]} />
                    ))}
                    <LabelList dataKey="value" position="inside" fill="#fff" fontSize={11.5} formatter={(x: unknown) => `${x}${v.unit}`} />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(x: unknown) => `${x}${v.unit}`} />
                  <Legend wrapperStyle={{ fontSize: 11.5 }} />
                </PieChart>
              </ResponsiveContainer>
            </figure>
          ))}
        </div>
      );
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                {v.columns.map((c) => (
                  <th key={c} className="border border-line-strong bg-surface-2 px-2.5 py-1.5 text-left font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={`border border-line px-2.5 py-1.5 ${typeof c === 'number' ? 'text-right font-mono' : ''}`}>
                      {typeof c === 'number' ? c.toLocaleString('en-GB') : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'process':
      return (
        <div>
          <ol className="flex flex-wrap items-stretch justify-center gap-2">
            {v.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <div className="w-36 rounded-xl border border-line-strong bg-surface p-2.5 text-center sm:w-40">
                  <div className="mx-auto mb-1 grid h-6 w-6 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 1}</div>
                  <div className="text-[13px] leading-tight font-semibold">{s.label}</div>
                  {s.detail && <div className="mt-1 text-[11.5px] leading-tight text-muted">{s.detail}</div>}
                </div>
                {i < v.steps.length - 1 && <ArrowRight className="hidden shrink-0 text-muted sm:block" size={18} />}
                {i < v.steps.length - 1 && <ArrowDown className="shrink-0 text-muted sm:hidden" size={16} />}
              </li>
            ))}
          </ol>
          {v.cyclic && (
            <p className="mt-2 flex items-center justify-center gap-1 text-[12px] text-muted">
              <RotateCw size={13} /> the cycle then repeats from stage 1
            </p>
          )}
        </div>
      );
    case 'map':
      return (
        <div className="grid gap-3">
          {v.maps.map((m) => (
            <DiagramView key={m.title} d={m.diagram} title={m.title} />
          ))}
        </div>
      );
  }
}

export function Task1Visual({ visual }: { visual: Visual }) {
  const parts: Base[] = visual.type === 'mixed' ? visual.visuals : [visual];
  return (
    <figure className="rounded-2xl border border-line bg-surface p-4 text-ink">
      <figcaption className="mb-3 text-center text-[14px] font-semibold">{visual.title}</figcaption>
      <div className="space-y-6">
        {parts.map((p, i) => (
          <div key={i}>
            {visual.type === 'mixed' && <div className="mb-2 text-center text-[13px] font-medium text-muted">{p.title}</div>}
            <Chart v={p} />
          </div>
        ))}
      </div>
      {'unit' in visual && visual.unit && visual.type !== 'pie' && <p className="mt-1 text-right text-[11px] text-faint">Unit: {visual.unit}</p>}
    </figure>
  );
}
