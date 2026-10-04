# 📋 Requisitos del sistema — Job Machine

Lista de todo lo que se necesita para que el proyecto funcione de punta a punta.
Marca `[x]` conforme se consigue.

---

## 1. 🖥️ Entorno base (la PC de DarkN)

- [x] Node.js (v24.18.0 ya instalado)
- [x] Docker instalado (v24.0.6)
- [ ] **Docker Desktop CORRIENDO** (hoy el daemon está apagado — abrir Docker Desktop)
- [x] Script de búsqueda web gratis: `websearch.mjs` (DuckDuckGo, sin API key)
- [ ] Imagen base de Playwright descargada (`mcr.microsoft.com/playwright:v1.6x-noble`)

> **Nota clave:** con Docker, el motor corre **headless en contenedor** → funciona con
> la **PC bloqueada** (solo necesita estar encendida y Docker arriba). Adiós a los
> problemas de permisos/sandbox que tenía Codex.

---

## 2. 📄 CV master (lo más importante para "cantidad + optimizado")

El motor adapta el CV **por cada vacante** usando las keywords de la descripción.
Para eso necesita el CV en **texto editable**, NO en PDF.

- [ ] **DarkN:** poner el CV master en `cv-master/master.md` (Markdown editable).
      Hoy solo existen PDFs locales (fuera del repo): versiones ATS/Verified en inglés y español.
- [ ] Decidir idioma base del master (recomendado: **inglés**, es lo que piden casi todas
      las remotas; se puede tener variante ES).
- [ ] Definir qué secciones son **fijas** (datos, educación) y cuáles se **ajustan por
      vacante** (resumen/perfil, stack destacado, bullets de experiencia).
- [ ] Plantilla de PDF (cómo se ve el CV final). Opciones: HTML->PDF (Playwright/puppeteer),
      o reusar el pipeline local que ya genera los PDFs.

### Datos personales fijos (para rellenar formularios)
- [ ] Nombre completo (en `cv-master/master.md`, local)
- [ ] Email de postulación
- [ ] Teléfono
- [ ] Ciudad / país (ej. "Mexico City, Mexico")
- [ ] LinkedIn / GitHub / portafolio (URLs)
- [ ] Respuestas tipo a preguntas comunes de ATS:
      - "¿Por qué este rol?" (plantilla que se personaliza)
      - Salario esperado (rango por moneda)
      - ¿Requiere visa/sponsorship? (No / autorizado para remoto)
      - Disponibilidad / notice period

---

## 3. 🤖 Motor de postulación (`engine/`) — lo construye GabyBot

- [ ] **detect-ats.mjs** — detectar el ATS por dominio de la URL:
      - Greenhouse (`boards.greenhouse.io`, `job-boards.greenhouse.io`)
      - Lever (`jobs.lever.co`)
      - Ashby (`jobs.ashbyhq.com`)
      - JazzHR / Resumator (`*.applytojob.com`)
      - Workday (`*.myworkdayjobs.com`)
      - Genérico (fallback: detectar campos por heurística)
- [ ] **adapt-cv.mjs** — leer descripción de vacante, extraer keywords, reescribir el
      master y generar el PDF adaptado.
- [ ] **apply/*.mjs** — un módulo por ATS (reusa los que ya existen):
      - Base: `scripts\bydrec-apply.mjs`, `scripts\optery-apply.mjs`,
        `scripts\glacier-apply.mjs` en el workspace de OpenClaw.
- [ ] **captcha-guard.mjs** — detectar reCAPTCHA/hCaptcha/Turnstile:
      - Sin captcha -> enviar sola.
      - Con captcha -> dejar pre-llena, screenshot, pasar link a DarkN por Telegram.
- [ ] **run-batch.mjs** — tomar N vacantes de la cola, correr el flujo, loguear a DB.
- [ ] **Stealth** — `playwright-extra` + `puppeteer-extra-plugin-stealth` (gratis) para
      reducir detección. Si headless se detecta mucho: modo headful con Xvfb en el contenedor.
- [ ] **Dockerfile + docker-compose.yml** — contenerizar; volumen para `data/` y `cv-master/`.

---

## 4. 🗄️ Panel + Base de datos (`web/`) — lo hace DarkN con Claude

- [ ] Django + base de datos (recomendado **PostgreSQL**; SQLite para empezar sirve).
- [ ] Modelos mínimos (ver `docs/INTEGRATION.md` para el contrato exacto):
      - `Vacante` (empresa, puesto, url, ats, salario, modalidad, keywords, fecha)
      - `Postulacion` (vacante, estado, fecha_envio, cv_usado, captcha_pendiente, notas)
      - `CVGenerado` (vacante, ruta_pdf, keywords_usadas, fecha)
- [ ] Vista de panel: lista filtrable de postulaciones (lo que hoy es el Excel).
- [ ] **Forma de conexión con el motor** — elegir UNA:
      - (a) El motor escribe DIRECTO a la DB (requiere credenciales DB), o
      - (b) Django expone un **API REST** (`POST /api/postulaciones`, etc.) y el motor
            habla por HTTP (más limpio y portable; **recomendado**).

---

## 5. ☁️ Hosting / despliegue

- [ ] Decidir dónde vive el panel Django:
      - VPS Tony (e2-micro, 1GB + swap) — justo, ya corre tonybot.
      - Otro VPS 2GB+ — cómodo para Django+Postgres. **Recomendado si es "a lo grande".**
- [ ] Decidir dónde corre el motor:
      - Local (PC de DarkN, encendida por WoL de madrugada) — como hoy.
      - O en el VPS (si el VPS aguanta Chromium; pide RAM — 2GB+ recomendado).
- [ ] Red: cómo se ven motor y panel (misma máquina / Tailscale / API público con auth).

---

## 6. 🔌 Integración con el flujo de madrugada existente

Ya existe (ver memoria `empleo-codex-lidia`):
- [x] Lidia (Raspberry) enciende la PC por Wake-on-LAN y dispara por A2A.
- [x] `job-run-auto.ps1` orquesta y apaga sola al terminar.
- [ ] **Adaptar** ese flujo para que llame al nuevo motor Docker en vez de a Codex,
      o correr ambos (Codex busca+verifica, motor Docker postula el lote aprobado).

---

## ✅ Mínimo para el PRIMER lote de prueba

Lo imprescindible para probar 2-3 postulaciones reales:
1. Docker Desktop corriendo.
2. CV master en texto (`cv-master/master.md`) + datos personales fijos.
3. Motor con 1-2 módulos de ATS (los que más salen: Ashby y Greenhouse).
4. captcha-guard que al menos detecte y salte (no hace falta resolverlo).
5. Un lugar donde loguear el resultado (al inicio un JSON/CSV; la DB después).
