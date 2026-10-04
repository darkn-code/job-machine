import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Empresa, Estado, Evento, Postulacion, PostulacionDetalle, Stats, Vacante } from "./types";

// El bot actualiza la DB por su cuenta: refrescamos solos cada 30 s.
const VIVO = { refetchInterval: 30_000 };

export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("stats"), ...VIVO });

export const usePostulaciones = (params = "") =>
  useQuery({
    queryKey: ["postulaciones", params],
    queryFn: () => api<Postulacion[]>(`postulaciones${params ? `?${params}` : ""}`),
    ...VIVO,
  });

export const usePostulacion = (id: number) =>
  useQuery({ queryKey: ["postulacion", id], queryFn: () => api<PostulacionDetalle>(`postulaciones/${id}`), ...VIVO });

export const useVacantes = (params = "") =>
  useQuery({
    queryKey: ["vacantes", params],
    queryFn: () => api<Vacante[]>(`vacantes${params ? `?${params}` : ""}`),
    ...VIVO,
  });

export const useEmpresas = () =>
  useQuery({ queryKey: ["empresas"], queryFn: () => api<Empresa[]>("empresas?ordering=-ultima_postulacion"), ...VIVO });

/** Invalida todo lo que depende de postulaciones (listas, detalle, stats). */
function useRefrescar() {
  const qc = useQueryClient();
  return () => {
    for (const k of ["stats", "postulaciones", "postulacion", "vacantes", "empresas"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

export function useCambiarEstado() {
  const qc = useQueryClient();
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: Estado }) =>
      api<Postulacion>(`postulaciones/${id}`, { method: "PATCH", body: { estado } }),
    // Optimista: el Kanban mueve la tarjeta al instante.
    onMutate: async ({ id, estado }) => {
      await qc.cancelQueries({ queryKey: ["postulaciones"] });
      const previas = qc.getQueriesData<Postulacion[]>({ queryKey: ["postulaciones"] });
      qc.setQueriesData<Postulacion[]>({ queryKey: ["postulaciones"] }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, estado } : p)),
      );
      return { previas };
    },
    onError: (_e, _v, ctx) => ctx?.previas.forEach(([k, d]) => qc.setQueryData(k, d)),
    onSettled: refrescar,
  });
}

export function useActualizarPostulacion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Postulacion> & { id: number }) =>
      api<Postulacion>(`postulaciones/${id}`, { method: "PATCH", body }),
    onSuccess: refrescar,
  });
}

export function useRegistrar() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Postulacion>("postulaciones/registrar", { method: "POST", body }),
    onSuccess: refrescar,
  });
}

export function useCrearEvento() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Evento>("eventos", { method: "POST", body }),
    onSuccess: refrescar,
  });
}

export function useAccionVacante() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ id, accion }: { id: number; accion: "aprobar" | "descartar" }) =>
      api<Vacante>(`vacantes/${id}/${accion}`, { method: "POST" }),
    onSuccess: refrescar,
  });
}

export function useCrearVacante() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Vacante>("vacantes", { method: "POST", body }),
    onSuccess: refrescar,
  });
}
