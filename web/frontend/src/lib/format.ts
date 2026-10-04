const fmtFecha = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const fmtFechaHora = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtNum = new Intl.NumberFormat("es-MX");

export const fecha = (iso: string | null | undefined) => (iso ? fmtFecha.format(new Date(iso)) : "—");
export const fechaHora = (iso: string | null | undefined) => (iso ? fmtFechaHora.format(new Date(iso)) : "—");
export const num = (n: number) => fmtNum.format(n);

export function hace(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const s = Math.abs(diff);
  const [v, u] =
    s < 60 ? [Math.round(s), "s"] :
    s < 3600 ? [Math.round(s / 60), "min"] :
    s < 86400 ? [Math.round(s / 3600), "h"] :
    [Math.round(s / 86400), "d"];
  return diff < 0 ? `en ${v} ${u}` : `hace ${v} ${u}`;
}

export function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function salario(min: number | null, max: number | null, moneda: string): string {
  if (!min && !max) return "No publicado";
  const k = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : fmtNum.format(n));
  const rango = min && max && min !== max ? `${k(min)}–${k(max)}` : k((max || min) as number);
  return `${rango} ${moneda}`.trim();
}

/** ISO -> "2026-10-03T12:00" para <input type="datetime-local">. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
