import { useState, type FormEvent } from "react";
import { DragonHero, DragonLogo } from "../components/DragonLogo";
import { api, errorTexto } from "../lib/api";

export function Login({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const r = await api<{ token: string; username: string }>("auth/login", { method: "POST", body: { username, password } });
      onLogin(r.token, r.username);
    } catch (err) {
      setError(errorTexto(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="relative grid min-h-screen items-center overflow-hidden px-4 py-10 lg:grid-cols-2 lg:px-16">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-dragon-900/40 to-transparent" />

      {/* Héroe: dragón DarkN dentro de anillos */}
      <div className="relative mx-auto hidden aspect-square w-full max-w-[560px] items-center justify-center lg:flex" aria-hidden="true">
        <div className="absolute inset-0 rounded-full border border-dragon-600/50" />
        <div className="absolute inset-[12%] rounded-full border border-dashed border-ink-500" />
        <div className="absolute inset-[22%] rounded-full bg-dragon-500/10 blur-3xl" />
        <span className="absolute top-[8%] right-[14%] font-display text-xs font-bold tracking-[0.3em] text-txt-3">DN // 047</span>
        <span className="absolute bottom-[8%] left-[4%] font-display text-xs font-bold tracking-[0.3em] text-txt-3">JOB MACHINE / DRAGON PANEL</span>
        <DragonHero className="relative w-[85%] -rotate-[5deg] drop-shadow-[0_20px_24px_rgb(0_0_0/0.64)]" />
      </div>

      <form onSubmit={submit} className="panel fade-up relative mx-auto w-full max-w-md p-8 sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <DragonLogo size={44} />
          <div className="leading-none">
            <div className="font-display text-2xl font-bold uppercase italic tracking-wider">
              Dark<span className="text-dragon-400">N</span>
            </div>
            <div className="mt-1 font-display text-[11px] font-semibold uppercase tracking-[0.35em] text-txt-3">Job Machine</div>
          </div>
        </div>

        <p className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.25em] text-dragon-400">
          <span className="size-2 rounded-full bg-dragon-500 shadow-[0_0_10px_#e10600]" /> Dragon Panel
        </p>
        <h1 className="mt-3 font-display text-4xl leading-none font-bold sm:text-5xl">
          A cazar <span className="text-dragon-400 glow-text">empleo.</span>
        </h1>
        <p className="mt-3 mb-8 text-sm text-txt-2">Tus postulaciones, correos y lo que va moviendo GabyBot, en vivo.</p>

        <label className="block">
          <span className="label">Usuario</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="mt-4 block">
          <span className="label">Contraseña</span>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="mt-4 text-sm text-dragon-300">{error}</p>}
        <button className="btn btn-primary mt-6 w-full justify-center py-3 text-base" disabled={cargando}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
