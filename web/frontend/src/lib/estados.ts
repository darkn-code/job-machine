import type { Estado, EstadoVacante } from "./types";

export const ESTADOS: { id: Estado; label: string; color: string }[] = [
  { id: "por_postular", label: "Por postular", color: "var(--color-st-por_postular)" },
  { id: "captcha_pendiente", label: "Captcha pendiente", color: "var(--color-st-captcha)" },
  { id: "enviada", label: "Enviada", color: "var(--color-st-enviada)" },
  { id: "vista", label: "Vista", color: "var(--color-st-vista)" },
  { id: "entrevista", label: "Entrevista", color: "var(--color-st-entrevista)" },
  { id: "oferta", label: "Oferta", color: "var(--color-st-oferta)" },
  { id: "rechazada", label: "Rechazada", color: "var(--color-st-rechazada)" },
  { id: "error", label: "Error", color: "var(--color-st-error)" },
  { id: "saltada", label: "Saltada", color: "var(--color-st-saltada)" },
];

export const ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.id, e])) as Record<
  Estado,
  { id: Estado; label: string; color: string }
>;

/** Columnas del Kanban, en orden del embudo. */
export const KANBAN: Estado[] = ["captcha_pendiente", "enviada", "vista", "entrevista", "oferta", "rechazada"];

/** Embudo del dashboard (de "salió" a "oferta"). */
export const EMBUDO: Estado[] = ["enviada", "vista", "entrevista", "oferta", "rechazada"];

export const ESTADO_VACANTE: Record<EstadoVacante, string> = {
  nueva: "Por revisar",
  por_postular: "Aprobada · en cola",
  procesada: "Procesada",
  descartada: "Descartada",
};

export const ATS_LABEL: Record<string, string> = {
  ashby: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
  jazzhr: "JazzHR",
  workday: "Workday",
  getonbrd: "Get on Board",
  linkedin: "LinkedIn",
  generico: "Genérico",
};
