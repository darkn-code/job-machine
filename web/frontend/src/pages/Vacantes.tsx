import clsx from "clsx";
import { Check, ExternalLink, Plus, Radar, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AtsTag, Empty, ErrorBox, EstadoBadge, Field, Loading, Modal, PageHeader } from "../components/ui";
import { errorTexto } from "../lib/api";
import { ATS_LABEL, ESTADO_VACANTE } from "../lib/estados";
import { hace, salario } from "../lib/format";
import { useAccionVacante, useCrearVacante, useVacantes } from "../lib/queries";
import type { EstadoVacante } from "../lib/types";

const TABS: { id: EstadoVacante; hint: string }[] = [
  { id: "nueva", hint: "Detectadas por el bot o por ti. Apruébalas para que el motor postule." },
  { id: "por_postular", hint: "Aprobadas: el motor las toma en el próximo lote (GET /api/vacantes/pendientes)." },
  { id: "procesada", hint: "El motor ya intentó postular (ver su postulación)." },
  { id: "descartada", hint: "No cumplen o no interesan." },
];

export function Vacantes() {
  const [tab, setTab] = useState<EstadoVacante>("nueva");
  const [nueva, setNueva] = useState(false);
  const { data: todas } = useVacantes();
  const { data, isLoading, error } = useVacantes(`estado=${tab}&ordering=prioridad`);
  const accion = useAccionVacante();
  const conteo = (e: EstadoVacante) => todas?.filter((v) => v.estado === e).length ?? 0;

  return (
    <>
      <PageHeader
        title="Vacantes"
        subtitle="Regla dura: el motor solo postula lo que tú apruebas."
        actions={<button className="btn btn-primary" onClick={() => setNueva(true)}><Plus size={16} /> Agregar vacante</button>}
      />

      <div className="mb-2 flex gap-1 overflow-x-auto border-b border-ink-600">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 font-display text-sm font-bold whitespace-nowrap uppercase tracking-wider",
              tab === t.id ? "border-dragon-500 text-txt" : "border-transparent text-txt-3 hover:text-txt-2",
            )}
          >
            {ESTADO_VACANTE[t.id]} <span className="font-mono text-xs text-txt-3">{conteo(t.id)}</span>
          </button>
        ))}
      </div>
      <p className="mb-5 text-xs text-txt-3">{TABS.find((t) => t.id === tab)?.hint}</p>

      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : !data?.length ? (
        <div className="panel"><Empty icon={<Radar size={40} />} title="Vacío">No hay vacantes en esta lista.</Empty></div>
      ) : (
        <div className="space-y-3">
          {data.map((v) => (
            <article key={v.id} className="panel flex flex-wrap items-center gap-4 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center border border-ink-500 font-display text-lg font-bold text-dragon-400" title="Prioridad (1 = máxima)">
                P{v.prioridad}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-txt">{v.empresa} <span className="font-normal text-txt-2">· {v.puesto}</span></p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-txt-3">
                  <AtsTag ats={ATS_LABEL[v.ats] ?? v.ats} />
                  <span>{salario(v.salario_min, v.salario_max, v.moneda)}</span>
                  {v.modalidad && <span>· {v.modalidad}</span>}
                  <span>· detectada {hace(v.fecha_detectada)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {v.postulacion && (
                  <Link to={`/postulaciones/${v.postulacion.id}`}><EstadoBadge estado={v.postulacion.estado} /></Link>
                )}
                {v.url && (
                  <a href={v.url} target="_blank" rel="noreferrer" className="btn btn-ghost px-2.5" aria-label="Abrir vacante"><ExternalLink size={15} /></a>
                )}
                {(v.estado === "nueva" || v.estado === "descartada") && (
                  <button className="btn btn-primary" onClick={() => accion.mutate({ id: v.id, accion: "aprobar" })}><Check size={15} /> Aprobar</button>
                )}
                {(v.estado === "nueva" || v.estado === "por_postular") && (
                  <button className="btn btn-ghost" onClick={() => accion.mutate({ id: v.id, accion: "descartar" })}><X size={15} /> Descartar</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <NuevaVacante open={nueva} onClose={() => setNueva(false)} />
    </>
  );
}

function NuevaVacante({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vacio = { empresa: "", puesto: "", url: "", descripcion: "", salario_min: "", salario_max: "", moneda: "USD / año", modalidad: "remoto", prioridad: "3" };
  const [f, setF] = useState(vacio);
  const crear = useCrearVacante();
  const set = (k: keyof typeof vacio) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    crear.mutate(
      {
        ...f,
        url: f.url || null,
        salario_min: f.salario_min ? Number(f.salario_min) : null,
        salario_max: f.salario_max ? Number(f.salario_max) : null,
        prioridad: Number(f.prioridad),
      },
      { onSuccess: () => { setF(vacio); onClose(); } },
    );
  };
  return (
    <Modal open={open} onClose={onClose} title="Agregar vacante">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empresa *"><input required className="input" value={f.empresa} onChange={set("empresa")} autoFocus /></Field>
          <Field label="Puesto *"><input required className="input" value={f.puesto} onChange={set("puesto")} /></Field>
        </div>
        <Field label="URL (el ATS se detecta solo)"><input className="input" value={f.url} onChange={set("url")} placeholder="https://jobs.lever.co/..." /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sal. mín."><input type="number" className="input" value={f.salario_min} onChange={set("salario_min")} /></Field>
          <Field label="Sal. máx."><input type="number" className="input" value={f.salario_max} onChange={set("salario_max")} /></Field>
          <Field label="Moneda"><input className="input" value={f.moneda} onChange={set("moneda")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modalidad"><input className="input" value={f.modalidad} onChange={set("modalidad")} /></Field>
          <Field label="Prioridad">
            <select className="input" value={f.prioridad} onChange={set("prioridad")}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 1 ? " (máxima)" : n === 5 ? " (mínima)" : ""}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Descripción (para que el motor extraiga keywords)"><textarea rows={4} className="input" value={f.descripcion} onChange={set("descripcion")} /></Field>
        {crear.error && <p className="text-sm text-dragon-300">{errorTexto(crear.error)}</p>}
        {crear.data && "duplicada" in crear.data && <p className="text-sm text-st-vista">Esa URL ya estaba registrada.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={crear.isPending}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
