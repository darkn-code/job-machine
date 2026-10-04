import clsx from "clsx";
import { Building2, Flame, LayoutDashboard, ListChecks, LogOut, Menu, Plus, Radar, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useStats } from "../lib/queries";
import { DragonLogo, DragonWatermark } from "./DragonLogo";
import { NuevaPostulacionModal } from "./NuevaPostulacionModal";

export function Layout({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [menu, setMenu] = useState(false);
  const [nueva, setNueva] = useState(false);
  const { data: stats } = useStats();
  const { pathname } = useLocation();
  const k = stats?.kpis;

  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/postulaciones", label: "Postulaciones", icon: ListChecks },
    { to: "/captchas", label: "Captchas", icon: Flame, badge: k?.captchas, hot: true },
    { to: "/vacantes", label: "Vacantes", icon: Radar, badge: k?.vacantes_por_revisar },
    { to: "/empresas", label: "Empresas", icon: Building2 },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <DragonLogo size={44} />
        <div className="leading-none">
          <div className="font-display text-2xl font-bold uppercase italic tracking-wider text-txt">
            Dark<span className="text-dragon-400">N</span>
          </div>
          <div className="mt-1 font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-txt-3">Job Machine</div>
        </div>
      </div>

      <div className="px-4">
        <button className="btn btn-primary w-full justify-center" onClick={() => { setNueva(true); setMenu(false); }}>
          <Plus size={16} /> Nueva postulación
        </button>
      </div>

      <nav className="mt-6 flex-1 space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon, end, badge, hot }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMenu(false)}
            className={({ isActive }) =>
              clsx(
                "group relative flex items-center gap-3 px-3 py-2.5 font-display text-[15px] font-semibold uppercase tracking-wider transition",
                isActive
                  ? "bg-gradient-to-r from-dragon-900 to-transparent text-txt"
                  : "text-txt-2 hover:bg-ink-700/60 hover:text-txt",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx("absolute inset-y-1 left-0 w-[3px]", isActive ? "bg-dragon-500 shadow-[0_0_10px_#e10600]" : "bg-transparent")} />
                <Icon size={18} className={isActive ? "text-dragon-500" : "text-txt-3 group-hover:text-dragon-400"} />
                <span className="flex-1">{label}</span>
                {!!badge && (
                  <span className={clsx("min-w-6 rounded-sm px-1.5 text-center font-mono text-xs", hot ? "pulse-red bg-dragon-500 text-white" : "bg-ink-600 text-txt")}>
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative m-3 overflow-hidden border border-ink-600 bg-ink-850 p-4">
        <DragonWatermark className="absolute -right-4 -bottom-4 size-24 text-dragon-500/10" />
        <div className="text-[11px] uppercase tracking-widest text-txt-3">Sesión</div>
        <div className="mt-0.5 font-display text-lg font-bold text-txt">{username}</div>
        <button onClick={onLogout} className="mt-2 inline-flex items-center gap-1.5 text-xs text-txt-3 hover:text-dragon-400">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-600 bg-ink-950/95 lg:block">{sidebar}</aside>

      {/* Barra móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-600 bg-ink-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <DragonLogo size={30} />
          <span className="font-display text-lg font-bold uppercase italic tracking-wider">Dark<span className="text-dragon-400">N</span> <span className="not-italic text-txt-3 text-sm tracking-[0.2em]">Job Machine</span></span>
        </div>
        <button onClick={() => setMenu(true)} aria-label="Abrir menú" className="text-txt-2">
          <Menu />
        </button>
      </header>

      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-ink-600 bg-ink-950" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMenu(false)} aria-label="Cerrar menú" className="absolute top-4 right-4 text-txt-3">
              <X />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main key={pathname} className="fade-up mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet context={{ abrirNueva: () => setNueva(true) }} />
      </main>

      <NuevaPostulacionModal open={nueva} onClose={() => setNueva(false)} />
    </div>
  );
}
