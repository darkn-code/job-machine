import clsx from "clsx";
import { ArrowRight, BellRing, CalendarClock, Flame, Mail, MailOpen, MessageSquare, Repeat, Send, Swords, Target, Trophy, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ActividadChart, atsData, EmbudoChart, empresaData, RankingChart } from "../components/charts";
import { DragonWatermark } from "../components/DragonLogo";
import { Empty, ErrorBox, EstadoBadge, Loading, PageHeader, Panel } from "../components/ui";
import { ESTADO } from "../lib/estados";
import { fecha, hace } from "../lib/format";
import { useStats } from "../lib/queries";
import type { Estado, Evento } from "../lib/types";

function Kpi({ label, value, hint, icon, accent }: { label: string; value: ReactNode; hint?: string; icon: ReactNode; accent?: boolean }) {
  return (
    <div className={clsx("panel group overflow-hidden p-4", accent && "border-dragon-700")}>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-txt-3">{label}</span>
        <span className={clsx("transition", accent ? "text-dragon-500" : "text-txt-3 group-hover:text-dragon-500")}>{icon}</span>
      </div>
      <div className={clsx("mt-2 font-display text-4xl font-bold leading-none", accent ? "text-dragon-400 glow-text" : "text-txt")}>{value}</div>
      {hint && <div className="mt-2 text-xs text-txt-3">{hint}</div>}
    </div>
  );
}

const ICONO_EVENTO: Record<Evento["tipo"], ReactNode> = {
  correo_recibido: <MailOpen size={14} />,
  correo_enviado: <Send size={14} />,
  cambio_estado: <Repeat size={14} />,
  entrevista: <CalendarClock size={14} />,
  nota: <MessageSquare size={14} />,
};

export function EventoItem({ e, conEmpresa = true }: { e: Evento; conEmpresa?: boolean }) {
  const color = e.estado_nuevo ? ESTADO[e.estado_nuevo as Estado]?.color : undefined;
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span
        className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-ink-900 text-txt-2"
        style={{ borderColor: color ?? "var(--color-ink-500)" }}
      >
        {ICONO_EVENTO[e.tipo]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="truncate text-sm text-txt">
            {conEmpresa && (
              <Link to={`/postulaciones/${e.postulacion}`} className="font-semibold hover:text-dragon-400">{e.empresa} · </Link>
            )}
            {e.titulo || e.tipo}
          </p>
          <time className="shrink-0 text-[11px] text-txt-3" title={e.fecha}>{hace(e.fecha)}</time>
        </div>
        {e.remitente && <p className="text-xs text-txt-3">de {e.remitente}</p>}
        {e.contenido && <p className="mt-1 line-clamp-2 text-xs text-txt-2">{e.contenido}</p>}
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-txt-3">{e.actor}</p>
      </div>
    </li>
  );
}

export function Dashboard() {
  const { data: s, error, isLoading, dataUpdatedAt } = useStats();
  if (isLoading) return <Loading />;
  if (error || !s) return <ErrorBox error={error} />;
  const k = s.kpis;

  return (
    <>
      <PageHeader
        title="Centro de mando"
        subtitle={<>En vivo · se actualiza cada 30 s · última sincronización {hace(new Date(dataUpdatedAt).toISOString())}</>}
      />

      {k.captchas > 0 && (
        <Link
          to="/captchas"
          className="panel pulse-red mb-6 flex items-center gap-4 border-dragon-600 bg-gradient-to-r from-dragon-900 via-ink-800 to-ink-800 p-4 transition hover:from-dragon-700"
        >
          <Flame className="shrink-0 text-dragon-400" size={28} />
          <div className="flex-1">
            <p className="font-display text-lg font-bold uppercase tracking-wider">
              {k.captchas} {k.captchas === 1 ? "postulación espera" : "postulaciones esperan"} tu tap
            </p>
            <p className="text-sm text-txt-2">El motor las dejó pre-llenas. Resuelve el captcha y envía.</p>
          </div>
          <ArrowRight className="text-dragon-400" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Enviadas" value={k.enviadas} hint={`${k.empresas} empresas`} icon={<Send size={18} />} accent />
        <Kpi label="Esta semana" value={k.semana} hint="últimos 7 días" icon={<Zap size={18} />} />
        <Kpi label="En proceso" value={k.en_proceso} hint="enviadas + vistas" icon={<Mail size={18} />} />
        <Kpi label="Entrevistas" value={k.entrevistas} icon={<Swords size={18} />} />
        <Kpi label="Respuesta" value={`${k.tasa_respuesta}%`} hint="vista, entrevista, oferta o rechazo" icon={<Target size={18} />} />
        <Kpi label="Ofertas" value={k.ofertas} icon={<Trophy size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Postulaciones enviadas · 30 días" icon={<Zap size={16} />} className="xl:col-span-2">
          <ActividadChart data={s.por_dia} />
        </Panel>
        <Panel title="Estado actual" icon={<Target size={16} />}>
          <EmbudoChart porEstado={s.por_estado} />
          <div className="mt-3 flex justify-between border-t border-ink-600 pt-3 text-xs text-txt-3">
            <span>Cola del motor: <b className="text-txt">{k.vacantes_en_cola}</b></span>
            <span>Por revisar: <b className="text-txt">{k.vacantes_por_revisar}</b></span>
            <span>Errores: <b className="text-txt">{k.errores}</b></span>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Seguimientos" icon={<BellRing size={16} />}>
          {s.seguimientos.length === 0 ? (
            <Empty title="Todo al día">Nada que seguir en los próximos 3 días.</Empty>
          ) : (
            <ul className="divide-y divide-ink-600">
              {s.seguimientos.map((p) => {
                const vencido = p.proximo_seguimiento && new Date(p.proximo_seguimiento) < new Date();
                return (
                  <li key={p.id}>
                    <Link to={`/postulaciones/${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-ink-700/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-txt">{p.vacante.empresa}</p>
                        <p className="truncate text-xs text-txt-3">{p.proxima_accion || p.vacante.puesto}</p>
                      </div>
                      <div className="text-right">
                        <p className={clsx("text-xs font-semibold", vencido ? "text-dragon-400" : "text-txt-2")}>
                          {vencido ? "Vencido · " : ""}{fecha(p.proximo_seguimiento)}
                        </p>
                        <EstadoBadge estado={p.estado} className="mt-1" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Actividad reciente" icon={<Repeat size={16} />} action={<span className="text-[11px] text-txt-3">correos · bot · cambios</span>}>
          {s.actividad.length === 0 ? (
            <Empty title="Sin actividad aún" />
          ) : (
            <ul className="relative before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-ink-600">
              {s.actividad.slice(0, 7).map((e) => <EventoItem key={e.id} e={e} />)}
            </ul>
          )}
        </Panel>

        <Panel title="Dónde postulas" icon={<Target size={16} />} className="relative overflow-hidden lg:col-span-2 xl:col-span-1">
          <DragonWatermark className="pointer-events-none absolute -right-10 -bottom-10 size-48 text-dragon-500/[0.04]" />
          <p className="label">Por ATS / plataforma</p>
          {s.por_ats.length ? <RankingChart data={atsData(s)} /> : <p className="text-sm text-txt-3">Sin datos</p>}
          <p className="label mt-5">Top empresas</p>
          {s.por_empresa.length ? <RankingChart data={empresaData(s)} /> : <p className="text-sm text-txt-3">Sin datos</p>}
        </Panel>
      </div>
    </>
  );
}
