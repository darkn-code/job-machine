# 🤖 API de Job Machine (guía para GabyBot)

Base URL: `http://localhost:8000/api` en local (o `http://localhost:5173/api` desde el front),
y en el VPS `https://<tu-dominio>/api`.
Documentación interactiva (Swagger): **`/api/docs`**. Esquema OpenAPI: `/api/schema`.

## Autenticación

Todas las rutas (menos `/api/health` y `/api/auth/login`) llevan el header:

```
Authorization: Token <TOKEN_DEL_BOT>
```

El token del bot se genera en el servidor (y se manda a GabyBot por un canal seguro):

```bash
docker compose exec backend python manage.py create_bot_token            # crea/muestra (usuario gabybot)
docker compose exec backend python manage.py create_bot_token --rotar    # invalida el anterior
```

Todo lo que el bot cambie queda en la línea de tiempo con `actor: "gabybot"`.

---

## Flujo típico del motor

```bash
API=http://localhost:8000/api
H="Authorization: Token $TOKEN"

# 1. (opcional) Subir vacantes descubiertas. Dedup por url: si ya existe -> 200 + "duplicada": true
curl -X POST $API/vacantes -H "$H" -H "Content-Type: application/json" -d '{
  "empresa": "Acme Corp", "puesto": "Backend Engineer (Python)",
  "url": "https://jobs.ashbyhq.com/acme/abc123",
  "descripcion": "texto completo...", "salario_min": 60000, "salario_max": 90000,
  "moneda": "USD/año", "modalidad": "remoto LATAM", "prioridad": 2
}'
# -> queda en estado "nueva" (por revisar). El ATS se detecta solo por el dominio.

# 2. DarkN aprueba en el panel (pestaña Vacantes). Luego el motor pide su lote:
curl "$API/vacantes/pendientes?limit=3" -H "$H"

# 3. El motor reporta el resultado (upsert por vacante_id: reintentar no duplica)
curl -X POST $API/postulaciones -H "$H" -H "Content-Type: application/json" -d '{
  "vacante_id": 42, "estado": "captcha_pendiente",
  "cv_pdf": "data/cv/acme_42.pdf", "keywords_usadas": ["python","fastapi","aws"],
  "captcha_link": "https://jobs.ashbyhq.com/acme/abc123/application",
  "screenshot": "data/shots/acme_42.png", "notas": "hCaptcha detectado", "fecha_envio": null
}'
# -> 201 si es nueva, 200 si actualizó. La vacante pasa a "procesada".
```

## Reportar correos (lo que actualiza el panel según los mails)

Cuando el bot lee un correo de una empresa, lo registra como **evento**. Si mandas
`cambiar_estado`, la postulación cambia de estado en el mismo paso.

```bash
curl -X POST $API/eventos -H "$H" -H "Content-Type: application/json" -d '{
  "empresa_nombre": "Glacier",
  "tipo": "correo_recibido",
  "titulo": "Update on your application",
  "remitente": "hiring@glacier.com",
  "contenido": "there is not an ideal fit at this time...",
  "cambiar_estado": "rechazada"
}'
```

Para identificar la postulación usa **una** de estas (en este orden de prioridad):

| campo | cuándo usarlo |
|---|---|
| `postulacion_id` | si ya lo conoces (lo más preciso) |
| `vacante_id` | si tienes el id de la vacante |
| `url` | la url de la vacante (ej. el link del correo de Ashby/Greenhouse) |
| `empresa_nombre` | solo sabes la empresa: toma su postulación **más reciente** (sin importar mayúsculas) |

Si no encuentra nada -> `400` con explicación (no se pierde: reintenta con otro identificador).

`tipo`: `correo_recibido` · `correo_enviado` · `entrevista` · `nota` (`cambio_estado` lo crea el sistema solo).

## Estados

**Postulación** (`estado`):

| estado | significado |
|---|---|
| `por_postular` | creada pero aún sin enviar |
| `enviada` | salió (si no mandas `fecha_envio`, se pone la hora actual) |
| `captcha_pendiente` | pre-llenada; espera el tap de DarkN (`captcha_link`) |
| `error` / `saltada` | falló / no cumple |
| `vista` | la plataforma indica que la vieron (ej. Get on Board "Seen") |
| `entrevista` | invitación o entrevista agendada |
| `oferta` | llegó oferta 🎉 |
| `rechazada` | proceso cerrado |

**Vacante** (`estado`): `nueva` (por revisar) → `por_postular` (aprobada, la toma el motor) →
`procesada` (ya tiene postulación) · o `descartada`.

## Todos los endpoints

Todas aceptan con o sin `/` final.

| método | ruta | qué hace |
|---|---|---|
| GET | `/api/health` | ping (sin auth) |
| POST | `/api/auth/login` | `{username,password}` → `{token}` (lo usa el front) |
| GET | `/api/vacantes/pendientes?limit=N` | **contrato**: aprobadas para el motor |
| GET/POST | `/api/vacantes` | listar (`?estado=&ats=&empresa=&q=`) / crear (dedup url) |
| GET/PATCH/DELETE | `/api/vacantes/<id>` | detalle / editar / borrar |
| POST | `/api/vacantes/<id>/aprobar` · `/descartar` | lo que hace DarkN en el panel |
| GET/POST | `/api/postulaciones` | listar (`?estado=enviada,vista&empresa=&ats=&desde=&hasta=&q=&ordering=-fecha_envio`) / **contrato** upsert |
| GET/PATCH | `/api/postulaciones/<id>` | detalle (incluye `eventos`) / **contrato** actualizar |
| POST | `/api/postulaciones/registrar` | crea vacante + postulación de una (postulaciones hechas a mano) |
| GET/POST | `/api/eventos` | timeline / reportar correo o nota |
| GET | `/api/empresas` | empresas con conteos (vacantes, enviadas, activas, entrevistas) |
| GET | `/api/stats` | todo lo del dashboard (KPIs, series, actividad) |
| GET/POST | `/api/cvs` | historial de CVs generados (opcional) |

Paginación: sin `?page=` devuelve la lista completa; con `?page=1&page_size=50` pagina.

Para consultar el estado como "resumen", `GET /api/stats` → `kpis` tiene todo
(enviadas, semana, entrevistas, tasa de respuesta, captchas, cola del motor…).
