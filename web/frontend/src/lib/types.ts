export type Estado =
  | "por_postular" | "enviada" | "captcha_pendiente" | "error" | "saltada"
  | "vista" | "entrevista" | "oferta" | "rechazada";

export type EstadoVacante = "nueva" | "por_postular" | "procesada" | "descartada";

export interface VacanteMini {
  id: number;
  empresa: string;
  empresa_id: number;
  puesto: string;
  url: string | null;
  ats: string;
  salario_min: number | null;
  salario_max: number | null;
  moneda: string;
  modalidad: string;
  contrato: string;
  fuente: string;
  prioridad: number;
}

export interface Vacante extends VacanteMini {
  descripcion: string;
  keywords: string[];
  estado: EstadoVacante;
  fecha_detectada: string;
  postulacion: { id: number; estado: Estado; fecha_envio: string | null } | null;
}

export interface Postulacion {
  id: number;
  vacante: VacanteMini;
  estado: Estado;
  fecha_envio: string | null;
  cv_pdf: string;
  keywords_usadas: string[];
  captcha_link: string | null;
  screenshot: string | null;
  notas: string;
  brechas: string;
  proxima_accion: string;
  proximo_seguimiento: string | null;
  creado: string;
  actualizado: string;
}

export interface Evento {
  id: number;
  postulacion: number;
  empresa: string;
  puesto: string;
  tipo: "correo_recibido" | "correo_enviado" | "cambio_estado" | "entrevista" | "nota";
  titulo: string;
  remitente: string;
  contenido: string;
  estado_anterior: string;
  estado_nuevo: string;
  actor: string;
  fecha: string;
}

export interface PostulacionDetalle extends Postulacion {
  descripcion: string;
  eventos: Evento[];
}

export interface Empresa {
  id: number;
  nombre: string;
  web: string;
  notas: string;
  total_vacantes: number;
  total_postulaciones: number;
  activas: number;
  rechazadas: number;
  entrevistas: number;
  ultima_postulacion: string | null;
}

export interface Stats {
  kpis: {
    total: number; enviadas: number; semana: number; en_proceso: number; entrevistas: number;
    ofertas: number; rechazadas: number; captchas: number; errores: number; tasa_respuesta: number;
    vacantes_por_revisar: number; vacantes_en_cola: number; empresas: number;
  };
  por_estado: Record<Estado, number>;
  por_dia: { fecha: string; enviadas: number }[];
  por_ats: { ats: string; n: number }[];
  por_empresa: { empresa: string; n: number }[];
  seguimientos: Postulacion[];
  actividad: Evento[];
}
