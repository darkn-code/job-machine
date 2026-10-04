import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ATS_LABEL, EMBUDO, ESTADO } from "../lib/estados";
import type { Stats } from "../lib/types";

const AXIS = { fill: "var(--color-txt-3)", fontSize: 11 };
const GRID = "var(--color-ink-600)";
const fmtDia = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" });
const diaLocal = (iso: string) => new Date(`${iso}T12:00:00`);

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: { value: number; payload: Record<string, unknown> }[]; label?: string; fmt: (label: string, p: Record<string, unknown>) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-ink-500 bg-ink-950/95 px-3 py-2 text-xs shadow-xl">
      <div className="text-txt-3">{fmt(String(label), payload[0].payload)}</div>
      <div className="mt-0.5 font-display text-lg font-bold text-txt">{payload[0].value}</div>
    </div>
  );
}

/** Postulaciones enviadas por día (últimos 30 días). Una serie: sin leyenda, el título la nombra. */
export function ActividadChart({ data }: { data: Stats["por_dia"] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -24, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
        <XAxis
          dataKey="fecha" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={28}
          tickFormatter={(v: string) => fmtDia.format(diaLocal(v))}
        />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgb(225 6 0 / 0.08)" }}
          content={<Tip fmt={(l) => `${fmtDia.format(diaLocal(l))} · enviadas`} />}
        />
        <Bar dataKey="enviadas" fill="var(--color-dragon-500)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Embudo por estado: barras horizontales con etiqueta en el eje y valor directo (color = estado, nunca solo). */
export function EmbudoChart({ porEstado }: { porEstado: Stats["por_estado"] }) {
  const data = EMBUDO.map((e) => ({ estado: e, label: ESTADO[e].label, n: porEstado[e] ?? 0, color: ESTADO[e].color }));
  return (
    <ResponsiveContainer width="100%" height={data.length * 40 + 10}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={92} tick={{ ...AXIS, fill: "var(--color-txt-2)", fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.04)" }} content={<Tip fmt={(l) => l} />} />
        <Bar dataKey="n" radius={[0, 4, 4, 0]} minPointSize={3} background={{ fill: "var(--color-ink-700)" }}>
          {data.map((d) => <Cell key={d.estado} fill={d.color} />)}
          <LabelList dataKey="n" position="right" fill="var(--color-txt)" fontSize={13} fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranking simple (ATS o empresa): una serie, barras horizontales. */
export function RankingChart({ data }: { data: { label: string; n: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length, 1) * 34 + 10}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={120} tick={{ ...AXIS, fill: "var(--color-txt-2)", fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.04)" }} content={<Tip fmt={(l) => l} />} />
        <Bar dataKey="n" fill="var(--color-dragon-600)" radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="n" position="right" fill="var(--color-txt)" fontSize={12} fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const atsData = (s: Stats) => s.por_ats.map((r) => ({ label: ATS_LABEL[r.ats] ?? r.ats, n: r.n }));
export const empresaData = (s: Stats) => s.por_empresa.map((r) => ({ label: r.empresa, n: r.n }));
