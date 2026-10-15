import { Pencil, Save, Target } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorTexto } from "../lib/api";
import { useActualizarPostulacion, useHabilidades } from "../lib/queries";
import type { Postulacion } from "../lib/types";
import { Empty, ErrorBox, Field, Loading, Panel } from "./ui";

export function MatchBadge({ valor }: { valor: number | null }) {
  return <span className="inline-flex whitespace-nowrap border border-ink-600 bg-ink-850 px-2 py-0.5 font-mono text-xs text-txt-2">{valor == null ? "Sin evaluar" : `Match ${valor}%`}</span>;
}

function Habilidades({ titulo, items }: { titulo: string; items: string[] }) {
  return <div><p className="label">{titulo}</p><div className="flex flex-wrap gap-1.5">{items.length ? items.map((h) => <span key={h} className="border border-ink-600 px-2 py-1 text-xs text-txt-2">{h}</span>) : <p className="text-sm text-txt-3">Sin registrar</p>}</div></div>;
}

const leer = (p: Postulacion) => ({ porcentaje: p.match_porcentaje == null ? "" : String(p.match_porcentaje), coincidentes: p.habilidades_coincidentes.join("\n"), faltantes: p.habilidades_faltantes.join("\n"), notas: p.match_notas });
const lista = (texto: string) => [...new Map(texto.split(/\r?\n/).map((h) => h.trim()).filter(Boolean).map((h) => [h.toLocaleLowerCase(), h])).values()];

export function MatchEditor({ p }: { p: Postulacion }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState(() => leer(p));
  const actualizar = useActualizarPostulacion();
  const guardar = (e: FormEvent) => {
    e.preventDefault();
    actualizar.mutate({ id: p.id, match_porcentaje: f.porcentaje.trim() === "" ? null : Number(f.porcentaje), habilidades_coincidentes: lista(f.coincidentes), habilidades_faltantes: lista(f.faltantes), match_notas: f.notas }, { onSuccess: () => setEditando(false) });
  };
  return <Panel title="Match y habilidades" icon={<Target size={16} />} action={!editando && <button className="btn btn-ghost py-1" onClick={() => { setF(leer(p)); actualizar.reset(); setEditando(true); }}><Pencil size={14} /> Editar</button>}>
    <p className="mb-4 text-xs text-txt-3">Evaluación registrada manualmente o por el bot. El panel no calcula automáticamente el porcentaje.</p>
    {editando ? <form className="space-y-4" onSubmit={guardar}>
      <Field label="Match (%) · vacío = sin evaluar"><input type="number" min="0" max="100" step="any" className="input" value={f.porcentaje} onChange={(e) => setF({ ...f, porcentaje: e.target.value })} placeholder="0–100" /></Field>
      <p className="text-xs text-txt-3">Escribe una habilidad por línea. Conserva nombres consistentes para comparar postulaciones.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Habilidades coincidentes"><textarea rows={5} className="input" value={f.coincidentes} onChange={(e) => setF({ ...f, coincidentes: e.target.value })} placeholder={"Python\nDocker"} /></Field>
        <Field label="Habilidades faltantes"><textarea rows={5} className="input" value={f.faltantes} onChange={(e) => setF({ ...f, faltantes: e.target.value })} placeholder={"Kubernetes\nTerraform"} /></Field>
      </div>
      <Field label="Notas de la evaluación"><textarea rows={3} className="input" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Field>
      {actualizar.error && <p role="alert" className="text-sm text-dragon-300">{errorTexto(actualizar.error)}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" disabled={actualizar.isPending} onClick={() => setEditando(false)}>Cancelar</button><button className="btn btn-primary" disabled={actualizar.isPending}><Save size={15} /> {actualizar.isPending ? "Guardando…" : "Guardar match"}</button></div>
    </form> : <div className="space-y-4">
      <MatchBadge valor={p.match_porcentaje} />
      <Habilidades titulo="Coincidentes" items={p.habilidades_coincidentes} />
      <Habilidades titulo="Faltantes" items={p.habilidades_faltantes} />
      {p.match_notas && <div><p className="label">Notas de la evaluación</p><p className="whitespace-pre-wrap text-sm text-txt-2">{p.match_notas}</p></div>}
      <Link to="/postulaciones?vista=habilidades" className="inline-block text-xs text-dragon-400 hover:underline">Ver habilidades de todas las postulaciones →</Link>
    </div>}
  </Panel>;
}

export function ResumenHabilidades({ postulaciones }: { postulaciones: Postulacion[] }) {
  const { data, isLoading, error } = useHabilidades();
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<"total" | "faltantes">("total");
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const habilidades = data.habilidades.filter((h) => h.habilidad.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase())).sort((a, b) => b[orden] - a[orden] || a.habilidad.localeCompare(b.habilidad));
  const porId = new Map(postulaciones.map((p) => [p.id, p]));
  return <Panel title="Habilidades más frecuentes" icon={<Target size={16} />}>
    <p className="mb-4 text-sm text-txt-3">Todas las postulaciones, sin filtros de empresa, estado o plataforma. Cada habilidad cuenta una vez por postulación. Datos registrados manualmente o por el bot.</p>
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      {[["Postulaciones", data.total_postulaciones], ["Con porcentaje evaluado", data.evaluadas], ["Match promedio", data.match_promedio == null ? "Sin evaluar" : `${data.match_promedio}%`]].map(([label, valor]) => <div key={label} className="border border-ink-600 p-3"><p className="label">{label}</p><p className="font-display text-2xl font-bold">{valor}</p></div>)}
    </div>
    {data.habilidades.length === 0 ? <Empty title="Aún no hay habilidades">Abre una postulación y edita su match para registrar habilidades coincidentes y faltantes.</Empty> : <>
      <div className="mb-4 flex flex-wrap gap-3"><input className="input min-w-48 flex-1" aria-label="Buscar habilidad" placeholder="Buscar habilidad…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /><select className="input w-auto" aria-label="Ordenar habilidades" value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}><option value="total">Más frecuentes</option><option value="faltantes">Más faltantes</option></select></div>
      <p className="mb-3 text-xs text-txt-3">{habilidades.length} habilidades · abre cada fila para ver sus postulaciones.</p>
      {habilidades.length === 0 ? <Empty title="Sin coincidencias">Prueba otro nombre de habilidad.</Empty> : <div className="space-y-2">{habilidades.map((h) => <details key={h.habilidad} className="border border-ink-600 p-3"><summary className="cursor-pointer text-sm"><span className="font-semibold">{h.habilidad}</span><span className="ml-3 inline-flex flex-wrap gap-x-3 text-xs text-txt-3"><span>{h.total} postulaciones</span><span>{h.coincidentes} coincidentes</span><span>{h.faltantes} faltantes</span></span></summary><div className="mt-3 flex flex-wrap gap-2">{h.postulacion_ids.map((id) => { const p = porId.get(id); return <Link key={id} to={`/postulaciones/${id}`} className="border border-ink-600 px-2 py-1 text-xs text-txt-2 hover:border-dragon-500 hover:text-txt">{p ? `${p.vacante.empresa} · ${p.vacante.puesto}` : `Postulación #${id}`}</Link>; })}</div></details>)}</div>}
    </>}
  </Panel>;
}
