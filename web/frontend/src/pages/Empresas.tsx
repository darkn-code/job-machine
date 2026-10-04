import { Building2, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorBox, Loading, PageHeader } from "../components/ui";
import { fecha } from "../lib/format";
import { useEmpresas } from "../lib/queries";

export function Empresas() {
  const { data, isLoading, error } = useEmpresas();
  const [q, setQ] = useState("");
  const lista = (data ?? []).filter((e) => e.nombre.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Empresas" subtitle="A cuántas vacantes de cada empresa has postulado y cómo va cada una." />
      <div className="relative mb-5 max-w-md">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-txt-3" />
        <input className="input pl-9" placeholder="Buscar empresa…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : !lista.length ? (
        <div className="panel"><Empty icon={<Building2 size={40} />} title="Sin empresas" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((e) => (
            <Link key={e.id} to={`/postulaciones?q=${encodeURIComponent(e.nombre)}`} className="panel group block p-5 transition hover:border-dragon-600">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-bold text-txt group-hover:text-dragon-400">{e.nombre}</p>
                  <p className="text-xs text-txt-3">Última postulación: {fecha(e.ultima_postulacion)}</p>
                </div>
                <div className="flex size-11 shrink-0 items-center justify-center border border-ink-500 bg-ink-900 font-display text-2xl font-bold text-dragon-500">
                  {e.nombre.charAt(0).toUpperCase()}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-ink-600 pt-3 text-center">
                {[
                  ["Vacantes", e.total_vacantes],
                  ["Enviadas", e.total_postulaciones],
                  ["Activas", e.activas],
                  ["Entrev.", e.entrevistas],
                ].map(([l, n]) => (
                  <div key={l}>
                    <dd className="font-display text-xl font-bold text-txt">{n}</dd>
                    <dt className="text-[10px] uppercase tracking-wider text-txt-3">{l}</dt>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
