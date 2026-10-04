import { ArrowLeft, ExternalLink, FileText, Flame, History, Pencil, Save } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AtsTag, ErrorBox, EstadoBadge, Field, Loading, Panel } from "../components/ui";
import { errorTexto } from "../lib/api";
import { ATS_LABEL, ESTADO, ESTADOS } from "../lib/estados";
import { fecha, fechaHora, fromLocalInput, salario, toLocalInput } from "../lib/format";
import { useActualizarPostulacion, useCambiarEstado, useCrearEvento, usePostulacion } from "../lib/queries";
import type { Estado, PostulacionDetalle as Detalle } from "../lib/types";
import { EventoItem } from "./Dashboard";

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-sm text-txt">{children || <span className="text-txt-3">—</span>}</dd>
    </div>
  );
}

export function PostulacionDetalle() {
  const id = Number(useParams().id);
  const { data: p, isLoading, error } = usePostulacion(id);
  const cambiar = useCambiarEstado();
  if (isLoading) return <Loading />;
  if (error || !p) return <ErrorBox error={error} />;

  return (
    <>
      <Link to="/postulaciones" className="mb-4 inline-flex items-center gap-1.5 text-sm text-txt-3 hover:text-dragon-400">
        <ArrowLeft size={16} /> Postulaciones
      </Link>

      <div className="panel relative mb-6 overflow-hidden p-5 sm:p-6" style={{ borderTop: `2px solid ${ESTADO[p.estado].color}` }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-dragon-500">{p.vacante.empresa}</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-txt sm:text-3xl">{p.vacante.puesto}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <EstadoBadge estado={p.estado} />
              <AtsTag ats={ATS_LABEL[p.vacante.ats] ?? p.vacante.ats} />
              <span className="text-xs text-txt-3">Enviada {fecha(p.fecha_envio)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="input w-auto"
              value={p.estado}
              onChange={(e) => cambiar.mutate({ id: p.id, estado: e.target.value as Estado })}
              aria-label="Cambiar estado"
            >
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
            {p.vacante.url && (
              <a className="btn btn-ghost" href={p.vacante.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Vacante</a>
            )}
          </div>
        </div>

        {p.estado === "captcha_pendiente" && p.captcha_link && (
          <a href={p.captcha_link} target="_blank" rel="noreferrer" className="pulse-red mt-4 flex items-center gap-3 border border-dragon-600 bg-dragon-900/60 p-3 text-sm hover:bg-dragon-900">
            <Flame className="text-dragon-400" size={20} />
            <span className="flex-1"><b>Captcha pendiente.</b> Abre el formulario pre-llenado, resuélvelo y envía.</span>
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Panel title="Vacante" icon={<FileText size={16} />}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Dato label="Salario">{salario(p.vacante.salario_min, p.vacante.salario_max, p.vacante.moneda)}</Dato>
              <Dato label="Modalidad">{p.vacante.modalidad}</Dato>
              <Dato label="Contrato">{p.vacante.contrato}</Dato>
              <Dato label="Fuente">{p.vacante.fuente}</Dato>
              <Dato label="Fecha envío">{fechaHora(p.fecha_envio)}</Dato>
              <Dato label="CV usado">{p.cv_pdf && <span className="font-mono text-xs break-all">{p.cv_pdf}</span>}</Dato>
            </dl>
            {p.keywords_usadas.length > 0 && (
              <div className="mt-4">
                <p className="label">Keywords usadas en el CV</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.keywords_usadas.map((k) => (
                    <span key={k} className="border border-dragon-700 bg-dragon-900/40 px-2 py-0.5 font-mono text-xs text-dragon-300">{k}</span>
                  ))}
                </div>
              </div>
            )}
            {p.screenshot && <p className="mt-4 text-xs text-txt-3">Screenshot: <span className="font-mono">{p.screenshot}</span></p>}
            {p.descripcion && (
              <details className="mt-4 border-t border-ink-600 pt-3">
                <summary className="cursor-pointer text-sm text-txt-2 hover:text-txt">Ver descripción completa</summary>
                <p className="mt-2 text-sm whitespace-pre-wrap text-txt-2">{p.descripcion}</p>
              </details>
            )}
          </Panel>

          <Seguimiento p={p} />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <NuevoEvento postulacionId={p.id} />
          <Panel title="Línea de tiempo" icon={<History size={16} />}>
            <ul className="relative before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-ink-600">
              {p.eventos.map((e) => <EventoItem key={e.id} e={e} conEmpresa={false} />)}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Seguimiento({ p }: { p: Detalle }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({
    proxima_accion: p.proxima_accion, proximo_seguimiento: toLocalInput(p.proximo_seguimiento), notas: p.notas, brechas: p.brechas,
  });
  const actualizar = useActualizarPostulacion();

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    actualizar.mutate(
      { id: p.id, ...f, proximo_seguimiento: fromLocalInput(f.proximo_seguimiento) },
      { onSuccess: () => setEditando(false) },
    );
  };

  if (!editando) {
    return (
      <Panel
        title="Seguimiento"
        icon={<Pencil size={16} />}
        action={<button className="btn btn-ghost py-1" onClick={() => setEditando(true)}><Pencil size={14} /> Editar</button>}
      >
        <dl className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Dato label="Próxima acción">{p.proxima_accion}</Dato>
            <Dato label="Próximo seguimiento">{p.proximo_seguimiento && fecha(p.proximo_seguimiento)}</Dato>
          </div>
          <Dato label="Brechas / pendientes">{p.brechas && <span className="whitespace-pre-wrap">{p.brechas}</span>}</Dato>
          <Dato label="Notas">{p.notas && <span className="whitespace-pre-wrap text-txt-2">{p.notas}</span>}</Dato>
        </dl>
      </Panel>
    );
  }

  return (
    <Panel title="Seguimiento" icon={<Pencil size={16} />}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Próxima acción"><input className="input" value={f.proxima_accion} onChange={(e) => setF({ ...f, proxima_accion: e.target.value })} /></Field>
          <Field label="Próximo seguimiento"><input type="datetime-local" className="input" value={f.proximo_seguimiento} onChange={(e) => setF({ ...f, proximo_seguimiento: e.target.value })} /></Field>
        </div>
        <Field label="Brechas / pendientes"><textarea rows={2} className="input" value={f.brechas} onChange={(e) => setF({ ...f, brechas: e.target.value })} /></Field>
        <Field label="Notas"><textarea rows={4} className="input" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Field>
        {actualizar.error && <p className="text-sm text-dragon-300">{errorTexto(actualizar.error)}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
          <button className="btn btn-primary" disabled={actualizar.isPending}><Save size={15} /> Guardar</button>
        </div>
      </form>
    </Panel>
  );
}

function NuevoEvento({ postulacionId }: { postulacionId: number }) {
  const vacio = { tipo: "correo_recibido", titulo: "", remitente: "", contenido: "", cambiar_estado: "" };
  const [f, setF] = useState(vacio);
  const crear = useCrearEvento();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { ...f, postulacion_id: postulacionId };
    if (!f.cambiar_estado) delete body.cambiar_estado;
    crear.mutate(body, { onSuccess: () => setF(vacio) });
  };
  return (
    <Panel title="Registrar evento" icon={<History size={16} />}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              <option value="correo_recibido">Correo recibido</option>
              <option value="correo_enviado">Correo enviado</option>
              <option value="entrevista">Entrevista agendada</option>
              <option value="nota">Nota</option>
            </select>
          </Field>
          <Field label="Mover a estado">
            <select className="input" value={f.cambiar_estado} onChange={(e) => setF({ ...f, cambiar_estado: e.target.value })}>
              <option value="">(sin cambio)</option>
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Asunto / título"><input required className="input" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Field>
        {f.tipo.startsWith("correo") && (
          <Field label="Remitente"><input className="input" value={f.remitente} onChange={(e) => setF({ ...f, remitente: e.target.value })} placeholder="hiring@empresa.com" /></Field>
        )}
        <Field label="Detalle"><textarea rows={3} className="input" value={f.contenido} onChange={(e) => setF({ ...f, contenido: e.target.value })} /></Field>
        {crear.error && <p className="text-sm text-dragon-300">{errorTexto(crear.error)}</p>}
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={crear.isPending}>Agregar</button>
        </div>
      </form>
    </Panel>
  );
}
