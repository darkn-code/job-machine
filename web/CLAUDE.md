# Contexto para Claude Code — Panel `web/` (Django)

Estás construyendo el **panel web + base de datos** del proyecto **Job Machine**.
Lee primero estos docs del repo padre:
- `../README.md` — visión general y reparto de trabajo.
- `../docs/REQUIREMENTS.md` — requisitos (sección 4 = este panel).
- `../docs/INTEGRATION.md` — **contrato exacto** con el motor. RESPÉTALO: los modelos y/o
  el API deben coincidir con lo que ahí se define, porque el motor (hecho por otra parte)
  se conectará a esto.

## Estado: construido (2026-10-03)
- `backend/` Django 5 + DRF, app `tracker` (models, serializers, views, `tests.py` = contrato).
  Comandos: `seed`, `create_bot_token`, `ensure_admin`. Settings por env vars.
- `frontend/` React 19 + Vite + Tailwind v4 + Recharts + TanStack Query. Tema en `src/index.css`
  (tokens `ink-*`, `dragon-*`, `st-*` por estado). El dragón es el de la marca DarkN (mismos trazos que remote.darkn-47.com) en `components/DragonLogo.tsx`.
- Dev: `docker compose up` en la raíz. Prod: `docker-compose.prod.yml` (nginx en `frontend/nginx.conf`).
- Ampliaciones al contrato documentadas al final de `../docs/INTEGRATION.md`; guía en `../docs/API.md`.
- Al cambiar modelos: `docker compose exec backend python manage.py makemigrations tracker`.

## Qué construir (spec original)
Un panel Django que **reemplaza un Excel de seguimiento de postulaciones** y expone los
datos al motor de postulación.

### Modelos (ver INTEGRATION.md para los campos exactos)
- `Vacante`
- `Postulacion` (con máquina de estados: por_postular / enviada / captcha_pendiente /
  error / saltada / entrevista / rechazada)
- `CVGenerado` (opcional)

### Conexión con el motor — elegir UNA (recomendado: API REST)
- **API REST** (Django REST Framework) con TokenAuth. Endpoints en INTEGRATION.md:
  `GET /api/vacantes/pendientes`, `POST /api/postulaciones`, `PATCH /api/postulaciones/<id>`,
  `POST /api/vacantes`.
- O acceso directo a la DB (menos recomendado).

### Panel (UI)
- Lista filtrable de postulaciones (empresa, puesto, estado, fecha, salario).
- Destacar las `captcha_pendiente` con su link para que DarkN dé el tap.
- Idealmente: botón para cambiar estado a mano.

## Stack sugerido
- Django 5.x + Django REST Framework.
- DB: SQLite para empezar; PostgreSQL para producción (ver REQUIREMENTS sección 5).
- Simple y desplegable en un VPS (Gunicorn + Nginx, o `runserver` para dev).

## No hagas
- No construyas el motor de postulación (eso es `../engine/`, lo hace GabyBot).
- No cambies el contrato de `INTEGRATION.md` sin avisar (rompería la conexión del motor).

## Datos reales para pruebas
El historial actual (6 postulaciones) está en un Excel local (fuera del repo) y ya se migró a
`backend/tracker/seed/postulaciones.json` (gitignored; el seed lo omite si no existe).
