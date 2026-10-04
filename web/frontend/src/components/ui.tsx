import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { ESTADO } from "../lib/estados";
import type { Estado } from "../lib/types";

export function EstadoBadge({ estado, className }: { estado: Estado; className?: string }) {
  const e = ESTADO[estado];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold",
        className,
      )}
      style={{ color: "var(--color-txt)", borderColor: e.color, background: `color-mix(in srgb, ${e.color} 16%, transparent)` }}
    >
      <span className="size-2 rounded-full" style={{ background: e.color }} />
      {e.label}
    </span>
  );
}

export function Panel({
  title, icon, action, children, className,
}: { title?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("panel min-w-0 p-4 sm:p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="panel-title flex items-center gap-2">
            {icon && <span className="text-dragon-500">{icon}</span>}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-txt sm:text-4xl">
          <span className="mr-2 text-dragon-500 glow-text">/</span>
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-txt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({
  open, onClose, title, children, wide,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx("panel fade-up my-8 w-full p-5 sm:p-6", wide ? "max-w-3xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="panel-title text-lg">{title}</h2>
          <button onClick={onClose} className="text-txt-3 hover:text-dragon-400" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-dragon-600">{icon}</div>}
      <p className="font-display text-lg font-bold uppercase tracking-wider text-txt-2">{title}</p>
      {children && <div className="max-w-sm text-sm text-txt-3">{children}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="size-10 animate-spin rounded-full border-2 border-ink-600 border-t-dragon-500" />
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="panel border-dragon-700 p-4 text-sm text-dragon-300">
      {error instanceof Error ? error.message : "Algo salió mal."}
    </div>
  );
}

export function AtsTag({ ats }: { ats: string }) {
  return (
    <span className="rounded-sm bg-ink-700 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-txt-2">{ats}</span>
  );
}
