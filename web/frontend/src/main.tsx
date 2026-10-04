import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Loading } from "./components/ui";
import "./index.css";
import { api, getToken, setToken } from "./lib/api";
import { Captchas } from "./pages/Captchas";
import { Dashboard } from "./pages/Dashboard";
import { Empresas } from "./pages/Empresas";
import { Login } from "./pages/Login";
import { PostulacionDetalle } from "./pages/PostulacionDetalle";
import { Postulaciones } from "./pages/Postulaciones";
import { Vacantes } from "./pages/Vacantes";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: true } },
});

function App() {
  const [user, setUser] = useState<string | null | undefined>(getToken() ? undefined : null);

  useEffect(() => {
    if (user === undefined) {
      api<{ username: string }>("auth/me").then((r) => setUser(r.username)).catch(() => setUser(null));
    }
    const out = () => setUser(null);
    window.addEventListener("jm:logout", out);
    return () => window.removeEventListener("jm:logout", out);
  }, [user]);

  if (user === undefined) return <Loading />;
  if (user === null) {
    return <Login onLogin={(token, username) => { setToken(token); setUser(username); }} />;
  }

  const logout = () => {
    setToken(null);
    queryClient.clear();
    setUser(null);
  };

  return (
    <Routes>
      <Route element={<Layout username={user} onLogout={logout} />}>
        <Route index element={<Dashboard />} />
        <Route path="postulaciones" element={<Postulaciones />} />
        <Route path="postulaciones/:id" element={<PostulacionDetalle />} />
        <Route path="captchas" element={<Captchas />} />
        <Route path="vacantes" element={<Vacantes />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
