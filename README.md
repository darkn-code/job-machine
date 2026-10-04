# 🚀 Job Machine — Postulación autónoma de empleo

Sistema para automatizar la búsqueda y postulación a empleos remotos de **DarkN**
(perfil técnico: Python / backend / IoT / edge / cloud; remoto global).

Creado: 2026-10-03.

## 🎯 Objetivo

Enviar **cantidad** de postulaciones con **CV optimizado por vacante** (porque del otro
lado un ATS con IA filtra por keywords), de forma **autónoma** y **en lotes pequeños**
al inicio (para afinar), subiendo el nivel gradualmente.

## 🧩 Dos mitades del proyecto

| Mitad | Qué es | Quién la hace |
|---|---|---|
| **`engine/`** | Motor de postulación (Playwright + Docker): busca, filtra con IA, adapta el CV, llena formularios y envía. | **GabyBot** (cuando DarkN dé luz verde) |
| **`web/`** | Panel Django + base de datos (reemplaza el Excel de seguimiento). | **DarkN con Claude Code** |

El motor y el panel se comunican por **API REST** (Django + token).
Contrato: [`docs/INTEGRATION.md`](docs/INTEGRATION.md) · Guía práctica para el bot: [`docs/API.md`](docs/API.md).

## 🐉 Panel web (Dragon Panel)

Django 5 + DRF + PostgreSQL 16 (backend) · React + Vite + Tailwind + Recharts (frontend) · todo en Docker.

- **Dashboard**: KPIs (enviadas, semana, entrevistas, tasa de respuesta, ofertas), gráfica
  de los últimos 30 días, estado actual, seguimientos vencidos, actividad reciente (correos/bot).
- **Postulaciones**: tabla filtrable + **Kanban** (arrastra la tarjeta para cambiar estado).
- **Detalle**: datos de la vacante, keywords del CV, seguimiento editable y **línea de tiempo**.
- **Captchas**: las que el motor dejó pre-llenas, con botón "Abrir y dar tap".
- **Vacantes**: cola de aprobación (regla dura #1: el motor solo toma las aprobadas).
- **Empresas**: cuántas veces postulaste a cada una y cómo va.
- Se refresca solo cada 30 s, así ves lo que el bot va actualizando.

### Arrancar en local (desarrollo)

Requisito: Docker Desktop corriendo.

```bash
docker compose up --build
```

| qué | URL |
|---|---|
| Panel | http://localhost:5173 (usuario `darkn` / `dragon123` en dev) |
| API + Swagger | http://localhost:8000/api/docs |
| Admin Django | http://localhost:8000/admin |
| Postgres | `localhost:5432` (jobmachine / jobmachine) |

Al arrancar se aplican migraciones, se crea tu usuario y se carga el historial del Excel
(`web/backend/tracker/seed/postulaciones.json`, idempotente). El código se recarga solo al editar.

```bash
docker compose exec backend python manage.py create_bot_token   # token para GabyBot
docker compose exec backend python manage.py test tracker       # tests del contrato
docker compose down        # parar (los datos quedan en el volumen pgdata)
```

### Subir al VPS (producción) — CI/CD

**Plan completo en [`docs/DEPLOY.md`](docs/DEPLOY.md)**: GitHub Actions corre tests + escaneo de
secretos, publica las imágenes en GHCR y despliega por SSH al VPS (`scripts/deploy.sh`, con
backup previo, healthcheck y rollback). El deploy se activa con la variable `DEPLOY_ENABLED=true`.

En el VPS: un **nginx-proxy compartido** en Docker (`infra/proxy/` → `/opt/proxy`, puertos 80/443,
certbot para HTTPS) y este proyecto en `/opt/job-machine` sin puertos publicados, unido a la red
Docker `proxy` (alias `jobmachine-web`). Postgres no se publica. Consumo: ~350–450 MB RAM.

**Backup** de la base: `./scripts/backup.sh` (en el VPS corre diario por cron).

## 📁 Estructura

```
job-machine/
├── README.md                 # este archivo
├── docs/
│   ├── REQUIREMENTS.md        # requisitos técnicos de todo el sistema
│   ├── ENGINE.md              # diseño del motor (Playwright+Docker)
│   ├── INTEGRATION.md         # contrato motor <-> panel Django (DB/API)
│   └── API.md                 # guía de la API para GabyBot (curl)
├── docker-compose.yml         # dev local (Postgres + Django + Vite)
├── docker-compose.prod.yml    # VPS (Postgres + gunicorn + nginx)
├── .env.example               # variables para producción (.env real NUNCA va al repo)
├── .github/workflows/ci-cd.yml  # CI (tests, gitleaks) + CD (GHCR -> VPS)
├── scripts/                   # deploy.sh, backup.sh, vps-setup.sh (corren en el VPS)
├── infra/proxy/               # nginx-proxy compartido del VPS (+ certbot)
├── engine/                    # MOTOR (GabyBot) — aún vacío, se construye al dar luz verde
│   ├── src/
│   │   ├── detect-ats.mjs     # detecta Greenhouse/Lever/Ashby/JazzHR/Workday por URL
│   │   ├── adapt-cv.mjs       # master CV + keywords de la vacante -> CV ATS-optimizado
│   │   ├── captcha-guard.mjs  # detecta captcha: si hay, salta y avisa; si no, envía
│   │   ├── run-batch.mjs      # orquesta un lote pequeño y loguea
│   │   └── apply/             # un módulo por ATS
│   └── data/                  # (volumen Docker) CVs generados, cola, logs
├── cv-master/                 # CV master: solo master.example.md va al repo; tu master.md es local
└── web/
    ├── backend/               # Django + DRF (app `tracker`: modelos, API, stats, seed)
    └── frontend/              # React + Vite + Tailwind (tema dragón rojo/negro) + nginx
```

## 🚦 Estado

- [x] Carpeta y documentación base creadas (2026-10-03)
- [ ] **DarkN:** poner el CV master en texto editable en `cv-master/` (ver `docs/REQUIREMENTS.md`)
- [x] **DarkN:** construir `web/` (Django + Postgres + React, Docker) con Claude Code (2026-10-03)
- [x] Repo listo para GitHub + CI/CD (2026-10-04, ver `docs/DEPLOY.md`)
- [ ] **DarkN:** decidir hosting (VPS Tony 1GB vs otro 2GB+) y activar `DEPLOY_ENABLED`
- [ ] **GabyBot:** construir `engine/` (al dar luz verde)
- [ ] Conectar motor <-> panel (ver `docs/INTEGRATION.md`)
- [ ] Primer lote pequeño de prueba (2-3 vacantes) con OK manual de DarkN

## ⚖️ Reglas duras (no cambiar sin DarkN)

1. **Nunca postular sin OK de DarkN** mientras afinamos (lotes pequeños primero).
2. **Captcha:** solución GRATIS (stealth). Nada de servicios de pago.
   Si una vacante tiene captcha, el motor la deja pre-llena y pasa el link a DarkN.
3. Los **datos personales** (CV, correo, teléfono) se quedan locales; solo salen al
   formulario de la vacante que DarkN apruebe.
4. Descartar: BairesDev, ofertas rotas/caducadas, agregadores sin vacante real.
5. Piso **MXN 28,000 netos** = referencia de valor, no filtro de tipo de contrato.
