import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { errorTexto } from "../lib/api";
import { ESTADOS } from "../lib/estados";
import { fromLocalInput, toLocalInput } from "../lib/format";
import { useRegistrar } from "../lib/queries";
import { Field, Modal } from "./ui";

const VACIO = {
  empresa: "", puesto: "", url: "", estado: "enviada", fecha_envio: "", salario_min: "", salario_max: "",
  moneda: "USD / mes", modalidad: "100% remoto", contrato: "", fuente: "", notas: "", brechas: "",
  proxima_accion: "Revisar respuesta; seguimiento en una semana", proximo_seguimiento: "",
};

/** Registrar a mano una postulación hecha fuera del motor (correo, LinkedIn, etc.). */
export function NuevaPostulacionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState(() => ({ ...VACIO, fecha_envio: toLocalInput(new Date().toISOString()) }));
  const registrar = useRegistrar();
  const navigate = useNavigate();
  const set = (k: keyof typeof VACIO) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const seguimiento = f.proximo_seguimiento || toLocalInput(new Date(Date.now() + 7 * 86400000).toISOString());
    registrar.mutate(
      {
        ...f,
        url: f.url || null,
        salario_min: f.salario_min ? Number(f.salario_min) : null,
        salario_max: f.salario_max ? Number(f.salario_max) : null,
        fecha_envio: fromLocalInput(f.fecha_envio),
        proximo_seguimiento: fromLocalInput(seguimiento),
      },
      {
        onSuccess: (p) => {
          setF({ ...VACIO, fecha_envio: toLocalInput(new Date().toISOString()) });
          onClose();
          navigate(`/postulaciones/${p.id}`);
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva postulación" wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Empresa *"><input required className="input" value={f.empresa} onChange={set("empresa")} placeholder="Acme Corp" autoFocus /></Field>
        <Field label="Puesto *"><input required className="input" value={f.puesto} onChange={set("puesto")} placeholder="Backend Engineer (Python)" /></Field>
        <Field label="URL de la vacante" className="sm:col-span-2"><input className="input" value={f.url} onChange={set("url")} placeholder="https://jobs.ashbyhq.com/..." /></Field>
        <Field label="Estado">
          <select className="input" value={f.estado} onChange={set("estado")}>
            {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </Field>
        <Field label="Fecha de envío"><input type="datetime-local" className="input" value={f.fecha_envio} onChange={set("fecha_envio")} /></Field>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <Field label="Salario mín."><input type="number" className="input" value={f.salario_min} onChange={set("salario_min")} /></Field>
          <Field label="Salario máx."><input type="number" className="input" value={f.salario_max} onChange={set("salario_max")} /></Field>
          <Field label="Moneda / período"><input className="input" value={f.moneda} onChange={set("moneda")} /></Field>
        </div>
        <Field label="Modalidad"><input className="input" value={f.modalidad} onChange={set("modalidad")} /></Field>
        <Field label="Fuente"><input className="input" value={f.fuente} onChange={set("fuente")} placeholder="LinkedIn, Get on Board, referido…" /></Field>
        <Field label="Próxima acción"><input className="input" value={f.proxima_accion} onChange={set("proxima_accion")} /></Field>
        <Field label="Próximo seguimiento (default +7 días)"><input type="datetime-local" className="input" value={f.proximo_seguimiento} onChange={set("proximo_seguimiento")} /></Field>
        <Field label="Brechas / pendientes" className="sm:col-span-2"><textarea rows={2} className="input" value={f.brechas} onChange={set("brechas")} /></Field>
        <Field label="Notas" className="sm:col-span-2"><textarea rows={3} className="input" value={f.notas} onChange={set("notas")} /></Field>
        {registrar.error && <p className="text-sm text-dragon-300 sm:col-span-2">{errorTexto(registrar.error)}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={registrar.isPending}>{registrar.isPending ? "Guardando…" : "Registrar"}</button>
        </div>
      </form>
    </Modal>
  );
}
