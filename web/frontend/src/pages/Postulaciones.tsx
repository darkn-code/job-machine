import clsx from "clsx";
import { ExternalLink, Columns3, Plus, Rows3, Search } from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { AtsTag, Empty, ErrorBox, EstadoBadge, Loading, PageHeader } from "../components/ui";
import { ATS_LABEL, ESTADO, ESTADOS, KANBAN } from "../lib/estados";
import { diasDesde, fecha, salario } from "../lib/format";
import { useCambiarEstado, usePostulaciones } from "../lib/queries";
import type { Estado, Postulacion } from "../lib/types";

type Vista = "tabla" | "kanban";

function leerVista(): Vista {
  try {
    return localStorage.getItem("jm_vista") === "kanban" ? "kanban" : "tabla";
  } catch {
    return "tabla";
  }
}

export function Postulaciones() {
  const { data, isLoading, error } = usePostulaciones();
  const { abrirNueva } = useOutletContext<{ abrirNueva: () => void }>();
  const [params, setParams] = useSearchParams();
  const [vista, setVistaState] = useState<Vista>(leerVista);
  const q = params.get("q") ?? "";
  const estados = (params.get("estado") ?? "").split(",").filter(Boolean) as Estado[];
  const ats = params.get("ats") ?? "";
  const orden = params.get("orden") ?? "reciente";

  const setVista = (v: Vista) => {
    setVistaState(v);
    try { localStorage.setItem("jm_vista", v); } catch { /* sin storage */ }
  };
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const toggleEstado = (e: Estado) =>
    setParam("estado", (estados.includes(e) ? estados.filter((x) => x !== e) : [...estados, e]).join(","));

  const filtradas = useMemo(() => {
    const t = q.toLowerCase();
    const list = (data ?? []).filter(
      (p) =>
        (!t || `${p.vacante.empresa} ${p.vacante.puesto} ${p.notas}`.toLowerCase().includes(t)) &&
        (!estados.length || estados.includes(p.estado)) &&
        (!ats || p.vacante.ats === ats),
    );
    const ts = (s: string | null) => (s ? new Date(s).getTime() : 0);
    const sorters: Record<string, (a: Postulacion, b: Postulacion) => number> = {
      reciente: (a, b) => ts(b.fecha_envio) - ts(a.fecha_envio),
      antigua: (a, b) => ts(a.fecha_envio) - ts(b.fecha_envio),
      salario: (a, b) => (b.vacante.salario_max ?? 0) - (a.vacante.salario_max ?? 0),
      seguimiento: (a, b) => (ts(a.proximo_seguimiento) || Infinity) - (ts(b.proximo_seguimiento) || Infinity),
      empresa: (a, b) => a.vacante.empresa.localeCompare(b.vacante.empresa),
    };
    return list.sort(sorters[orden] ?? sorters.reciente);
  }, [data, q, estados, ats, orden]);

  const conteo = useMemo(() => {
    const c: Partial<Record<Estado, number>> = {};
    for (const p of data ?? []) c[p.estado] = (c[p.estado] ?? 0) + 1;
    return c;
  }, [data]);

  const atsPresentes = useMemo(() => [...new Set((data ?? []).map((p) => p.vacante.ats))], [data]);

  return (
    <>
      <PageHeader
        title="Postulaciones"
        subtitle={data ? `${filtradas.length} de ${data.length}` : undefined}
        actions={
          <>
            <div className="flex border border-ink-600" role="group" aria-label="Vista">
              {(["tabla", "kanban"] as Vista[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={clsx("flex items-center gap-1.5 px-3 py-2 font-display text-sm font-bold uppercase tracking-wider", vista === v ? "bg-dragon-500 text-white" : "text-txt-2 hover:text-txt")}
                >
                  {v === "tabla" ? <Rows3 size={15} /> : <Columns3 size={15} />} {v}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={abrirNueva}><Plus size={16} /> Nueva</button>
          </>
        }
      />

      {/* Filtros: una fila sobre los datos */}
      <div className="panel mb-5 space-y-3 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-txt-3" />
            <input className="input pl-9" placeholder="Buscar empresa, puesto, notas…" value={q} onChange={(e) => setParam("q", e.target.value)} />
          </div>
          <select className="input w-auto" value={ats} onChange={(e) => setParam("ats", e.target.value)} aria-label="ATS">
            <option value="">Todas las plataformas</option>
            {atsPresentes.map((a) => <option key={a} value={a}>{ATS_LABEL[a] ?? a}</option>)}
          </select>
          <select className="input w-auto" value={orden} onChange={(e) => setParam("orden", e.target.value)} aria-label="Orden">
            <option value="reciente">Más recientes</option>
            <option value="antigua">Más antiguas</option>
            <option value="seguimiento">Próximo seguimiento</option>
            <option value="salario">Mayor salario</option>
            <option value="empresa">Empresa A-Z</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.filter((e) => conteo[e.id]).map((e) => {
            const on = estados.includes(e.id);
            return (
              <button
                key={e.id}
                onClick={() => toggleEstado(e.id)}
                aria-pressed={on}
                className={clsx("flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold transition", on ? "text-txt" : "border-ink-600 text-txt-2 hover:border-ink-500")}
                style={on ? { borderColor: e.color, background: `color-mix(in srgb, ${e.color} 20%, transparent)` } : undefined}
              >
                <span className="size-2 rounded-full" style={{ background: e.color }} />
                {e.label} <span className="font-mono text-txt-3">{conteo[e.id]}</span>
              </button>
            );
          })}
          {(estados.length > 0 || q || ats) && (
            <button className="px-2 text-xs text-dragon-400 hover:underline" onClick={() => setParams({}, { replace: true })}>Limpiar filtros</button>
          )}
        </div>
      </div>

      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : filtradas.length === 0 ? (
        <div className="panel"><Empty title="Nada por aquí">Prueba con otros filtros o registra una postulación nueva.</Empty></div>
      ) : vista === "tabla" ? <Tabla items={filtradas} /> : <Kanban items={filtradas} />}
    </>
  );
}

function EstadoSelect({ p }: { p: Postulacion }) {
  const cambiar = useCambiarEstado();
  return (
    <select
      className="input w-auto py-1 text-xs"
      value={p.estado}
      onChange={(e) => cambiar.mutate({ id: p.id, estado: e.target.value as Estado })}
      aria-label={`Estado de ${p.vacante.empresa}`}
      style={{ borderColor: ESTADO[p.estado].color }}
    >
      {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
    </select>
  );
}

function Tabla({ items }: { items: Postulacion[] }) {
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-ink-600 text-left text-[11px] uppercase tracking-[0.12em] text-txt-3">
            <th className="px-4 py-3 font-semibold">Empresa / puesto</th>
            <th className="px-3 py-3 font-semibold">Estado</th>
            <th className="px-3 py-3 font-semibold">Enviada</th>
            <th className="px-3 py-3 font-semibold">Salario</th>
            <th className="px-3 py-3 font-semibold">Plataforma</th>
            <th className="px-3 py-3 font-semibold">Seguimiento</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const dias = diasDesde(p.fecha_envio);
            const vencido = p.proximo_seguimiento && new Date(p.proximo_seguimiento) < new Date() && ["enviada", "vista"].includes(p.estado);
            return (
              <tr key={p.id} className="group border-b border-ink-700 transition last:border-0 hover:bg-ink-700/40">
                <td className="relative px-4 py-3">
                  <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: ESTADO[p.estado].color }} />
                  <Link to={`/postulaciones/${p.id}`} className="block">
                    <span className="font-semibold text-txt group-hover:text-dragon-400">{p.vacante.empresa}</span>
                    <span className="block max-w-[340px] truncate text-xs text-txt-3">{p.vacante.puesto}</span>
                  </Link>
                </td>
                <td className="px-3 py-3"><EstadoSelect p={p} /></td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-txt-2">{fecha(p.fecha_envio)}</span>
                  {dias !== null && <span className="block text-[11px] text-txt-3">hace {dias} d</span>}
                </td>
                <td className="px-3 py-3 text-xs whitespace-nowrap text-txt-2">{salario(p.vacante.salario_min, p.vacante.salario_max, p.vacante.moneda)}</td>
                <td className="px-3 py-3"><AtsTag ats={ATS_LABEL[p.vacante.ats] ?? p.vacante.ats} /></td>
                <td className={clsx("px-3 py-3 text-xs whitespace-nowrap", vencido ? "font-semibold text-dragon-400" : "text-txt-2")}>
                  {p.proximo_seguimiento ? fecha(p.proximo_seguimiento) : "—"}
                </td>
                <td className="px-3 py-3 text-right">
                  {p.vacante.url && (
                    <a href={p.vacante.url} target="_blank" rel="noreferrer" className="text-txt-3 hover:text-dragon-400" aria-label="Abrir vacante">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Kanban({ items }: { items: Postulacion[] }) {
  const cambiar = useCambiarEstado();
  const [sobre, setSobre] = useState<Estado | null>(null);
  const otros = items.filter((p) => !KANBAN.includes(p.estado));

  const onDrop = (e: DragEvent, estado: Estado) => {
    e.preventDefault();
    setSobre(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const p = items.find((x) => x.id === id);
    if (p && p.estado !== estado) cambiar.mutate({ id, estado });
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN.map((estado) => {
          const col = items.filter((p) => p.estado === estado);
          const { label, color } = ESTADO[estado];
          return (
            <div
              key={estado}
              onDragOver={(e) => { e.preventDefault(); setSobre(estado); }}
              onDragLeave={() => setSobre((s) => (s === estado ? null : s))}
              onDrop={(e) => onDrop(e, estado)}
              className={clsx("flex w-72 shrink-0 flex-col border bg-ink-850/80 transition", sobre === estado ? "border-dragon-500 shadow-[0_0_20px_rgb(225_6_0/0.25)]" : "border-ink-600")}
            >
              <div className="flex items-center justify-between border-b border-ink-600 px-3 py-2.5" style={{ borderTop: `2px solid ${color}` }}>
                <span className="font-display text-sm font-bold uppercase tracking-wider">{label}</span>
                <span className="font-mono text-xs text-txt-3">{col.length}</span>
              </div>
              <div className="flex min-h-40 flex-1 flex-col gap-2 p-2">
                {col.map((p) => (
                  <Link
                    key={p.id}
                    to={`/postulaciones/${p.id}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(p.id))}
                    className="block cursor-grab border border-ink-600 bg-ink-800 p-3 transition hover:border-dragon-600 active:cursor-grabbing"
                  >
                    <p className="font-semibold text-txt">{p.vacante.empresa}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-txt-2">{p.vacante.puesto}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-txt-3">
                      <span>{fecha(p.fecha_envio)}</span>
                      <AtsTag ats={ATS_LABEL[p.vacante.ats] ?? p.vacante.ats} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {otros.length > 0 && (
        <div className="panel mt-2 p-4">
          <p className="label">Otros estados (cámbialos desde la tabla o el detalle)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {otros.map((p) => (
              <Link key={p.id} to={`/postulaciones/${p.id}`} className="flex items-center gap-2 border border-ink-600 px-2 py-1 text-xs hover:border-dragon-600">
                {p.vacante.empresa} <EstadoBadge estado={p.estado} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
