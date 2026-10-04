import { CheckCircle2, ExternalLink, Flame, SkipForward } from "lucide-react";
import { Link } from "react-router-dom";
import { AtsTag, Empty, ErrorBox, Loading, PageHeader } from "../components/ui";
import { ATS_LABEL } from "../lib/estados";
import { hace } from "../lib/format";
import { useCambiarEstado, usePostulaciones } from "../lib/queries";

/** Postulaciones que el motor dejó pre-llenas porque había captcha: tú das el tap. */
export function Captchas() {
  const { data, isLoading, error } = usePostulaciones("estado=captcha_pendiente&ordering=actualizado");
  const cambiar = useCambiarEstado();

  return (
    <>
      <PageHeader
        title="Captchas pendientes"
        subtitle="El motor llenó el formulario y se detuvo en el captcha. Ábrelo, resuélvelo, envía y márcalo aquí."
      />
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} /> : !data?.length ? (
        <div className="panel">
          <Empty icon={<CheckCircle2 size={40} />} title="Sin captchas pendientes">Cuando el motor encuentre uno, aparecerá aquí.</Empty>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <article key={p.id} className="panel flex flex-col border-dragon-700 p-5">
              <div className="flex items-start gap-3">
                <Flame className="mt-0.5 shrink-0 text-dragon-500" size={22} />
                <div className="min-w-0 flex-1">
                  <Link to={`/postulaciones/${p.id}`} className="font-display text-lg font-bold text-txt hover:text-dragon-400">{p.vacante.empresa}</Link>
                  <p className="text-sm text-txt-2">{p.vacante.puesto}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-txt-3">
                    <AtsTag ats={ATS_LABEL[p.vacante.ats] ?? p.vacante.ats} /> esperando {hace(p.actualizado).replace("hace ", "")}
                  </div>
                </div>
              </div>
              {p.notas && <p className="mt-3 line-clamp-3 text-xs text-txt-3">{p.notas}</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <a
                  href={p.captcha_link || p.vacante.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary flex-1 justify-center"
                >
                  <ExternalLink size={15} /> Abrir y dar tap
                </a>
                <button className="btn btn-ghost" onClick={() => cambiar.mutate({ id: p.id, estado: "enviada" })} title="Ya la envié">
                  <CheckCircle2 size={15} /> Enviada
                </button>
                <button className="btn btn-ghost" onClick={() => cambiar.mutate({ id: p.id, estado: "saltada" })} title="Saltar">
                  <SkipForward size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
