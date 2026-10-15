import { GraduationCap, Pencil, Plus, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorBox, Field, Loading, PageHeader, Panel } from "../components/ui";
import { errorTexto } from "../lib/api";
import { useEliminarHabilidadMejora, useGuardarHabilidadMejora, useHabilidadesMejora, usePostulaciones } from "../lib/queries";
import type { HabilidadMejora, Postulacion } from "../lib/types";

const estados = { pendiente: "Pendiente", en_progreso: "En progreso", aprendida: "Aprendida" };

function ListaPropia() {
  const { data, isLoading, error } = useHabilidadesMejora();
  const guardar = useGuardarHabilidadMejora();
  const eliminar = useEliminarHabilidadMejora();
  const vacia = { nombre: "", notas: "", estado: "pendiente" as HabilidadMejora["estado"] };
  const [form, setForm] = useState<Omit<HabilidadMejora, "id"> & { id?: number }>(vacia);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate(form, { onSuccess: () => setForm(vacia) });
  }
  return <Panel title="Mi plan de aprendizaje" icon={<GraduationCap size={18} />} className="mb-6">
    <p className="mb-4 text-sm text-txt-3">Agrega las habilidades que quieres mejorar, aunque todavía no aparezcan en una postulación.</p>
    <form onSubmit={enviar} className="mb-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Habilidad"><input className="input" required maxLength={120} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Kubernetes" /></Field>
        <Field label="Estado"><select className="input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as HabilidadMejora["estado"] })}>{Object.entries(estados).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      </div>
      <Field label="Notas / qué practicar"><textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Qué necesitas aprender, curso o proyecto para practicar…" /></Field>
      {guardar.error && <p role="alert" className="text-sm text-dragon-300">{errorTexto(guardar.error)}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {form.id && <button type="button" className="btn btn-ghost" disabled={guardar.isPending} onClick={() => { setForm(vacia); guardar.reset(); }}>Cancelar edición</button>}
        <button className="btn btn-primary" disabled={guardar.isPending}>{form.id ? <Save size={15} /> : <Plus size={15} />}{guardar.isPending ? "Guardando…" : form.id ? "Guardar cambios" : "Agregar habilidad"}</button>
      </div>
    </form>
    {eliminar.error && <p role="alert" className="mb-3 text-sm text-dragon-300">{errorTexto(eliminar.error)}</p>}
    {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : !data?.length ? <Empty title="Empieza tu lista">Agrega arriba la primera habilidad que quieres mejorar.</Empty> : <div className="space-y-3">{data.map((h) => <article key={h.id} className="border border-ink-600 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{h.nombre}</h3><span className="text-xs text-dragon-400">{estados[h.estado]}</span></div><div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost py-1" disabled={guardar.isPending} onClick={() => { setForm(h); guardar.reset(); }}><Pencil size={14} /> Editar</button>
        {confirmar === h.id ? <><button className="btn btn-ghost py-1 text-dragon-300" disabled={eliminar.isPending || guardar.isPending} onClick={() => eliminar.mutate(h.id, { onSuccess: () => { setConfirmar(null); if (form.id === h.id) setForm(vacia); } })}>Confirmar eliminar</button><button className="btn btn-ghost py-1" onClick={() => setConfirmar(null)}>Cancelar</button></> : <button className="btn btn-ghost py-1" onClick={() => setConfirmar(h.id)}>Eliminar</button>}
      </div></div>
      {h.notas && <p className="mt-3 whitespace-pre-wrap text-sm text-txt-2">{h.notas}</p>}
    </article>)}</div>}
  </Panel>;
}

export function HabilidadesAMejorar() {
  const { data, isLoading, error } = usePostulaciones();
  const [busqueda, setBusqueda] = useState("");
  const faltantes = new Map<string, { nombre: string; posts: Postulacion[] }>();
  for (const p of data ?? []) {
    const vistas = new Set<string>();
    for (const raw of p.habilidades_faltantes) {
      const nombre = raw.trim().replace(/\s+/g, " ");
      const key = nombre.toLocaleLowerCase();
      if (!key || vistas.has(key)) continue;
      vistas.add(key);
      const h = faltantes.get(key) ?? { nombre, posts: [] };
      h.posts.push(p);
      faltantes.set(key, h);
    }
  }
  const habilidades = [...faltantes.values()]
    .filter((h) => h.nombre.toLocaleLowerCase().includes(busqueda.trim().toLocaleLowerCase()))
    .sort((a, b) => b.posts.length - a.posts.length || a.nombre.localeCompare(b.nombre));

  return <>
    <PageHeader title="Habilidades a mejorar" subtitle="Identifica qué aprender y en qué oportunidades te hace falta." />
    <ListaPropia />
    <Panel title="Faltantes en postulaciones" icon={<GraduationCap size={18} />}>
      <p className="mb-4 text-sm text-txt-3">Habilidades registradas como faltantes en tus postulaciones, ordenadas por las que se repiten más. Abre una postulación para actualizar su evaluación.</p>
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : <>
        <input className="input mb-4" aria-label="Buscar habilidad a mejorar" placeholder="Buscar habilidad…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <p className="mb-3 text-xs text-txt-3">{faltantes.size} habilidades a mejorar</p>
        {habilidades.length === 0 ? <Empty title={faltantes.size ? "Sin coincidencias" : "Aún no hay habilidades faltantes"}>{faltantes.size ? "Prueba otro nombre de habilidad." : "En el detalle de una postulación, abre Match y habilidades → Editar y registra las habilidades que te faltan."}</Empty> :
          <div className="space-y-3">{habilidades.map((h) => <details key={h.nombre} className="border border-ink-600 p-4">
            <summary className="cursor-pointer text-sm"><span className="font-semibold">{h.nombre}</span><span className="ml-3 text-xs text-txt-3">Falta en {h.posts.length} {h.posts.length === 1 ? "postulación" : "postulaciones"}</span></summary>
            <div className="mt-3 flex flex-wrap gap-2">{h.posts.map((p) => <Link key={p.id} to={`/postulaciones/${p.id}`} className="border border-ink-600 px-2 py-1 text-xs text-txt-2 hover:border-dragon-500 hover:text-txt">{p.vacante.empresa} · {p.vacante.puesto}</Link>)}</div>
          </details>)}</div>}
      </>}
    </Panel>
  </>;
}
