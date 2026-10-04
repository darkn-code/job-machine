const TOKEN_KEY = "jm_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // navegador sin storage: la sesión dura lo que la pestaña
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    const detail = typeof data === "object" && data && "detail" in data ? String((data as { detail: unknown }).detail) : "";
    super(detail || `Error ${status}`);
    this.status = status;
    this.data = data;
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event("jm:logout"));
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Convierte los errores de validación de DRF en un texto legible. */
export function errorTexto(e: unknown): string {
  if (e instanceof ApiError && e.data && typeof e.data === "object") {
    return Object.entries(e.data as Record<string, unknown>)
      .map(([k, v]) => (k === "detail" ? String(v) : `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`))
      .join(" · ");
  }
  return e instanceof Error ? e.message : "Error inesperado";
}
