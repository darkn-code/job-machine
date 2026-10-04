# 🔌 Contrato de integración: Motor ↔ Panel Django

Este documento define cómo se hablan el **motor** (GabyBot, `engine/`) y el **panel**
(DarkN+Claude, `web/`). Si ambos respetan este contrato, se pueden construir en paralelo
sin pisarse.

> **Recomendación:** opción **API REST** (abajo). Es más limpia y portable que compartir
> credenciales de la base de datos. Pero si prefieres acceso directo a la DB, abajo está
> el esquema de tablas también.

---

> ✅ **Implementado (2026-10-03)** en `web/` con la opción API REST. Guía práctica con
> ejemplos curl: [`docs/API.md`](API.md). Swagger en `/api/docs`.
> Todo lo de abajo se respeta tal cual; las **ampliaciones** (no rompen nada) están al final.

## Opción recomendada: API REST en Django

El panel Django expone estos endpoints. El motor habla por HTTP (con un token simple).

### Autenticación
- Header `Authorization: Token <token>` (DRF TokenAuth o similar). Token lo genera el panel.

### Endpoints

#### `GET /api/vacantes/pendientes?limit=N`
Devuelve hasta N vacantes en estado `por_postular` para que el motor las procese.
```json
[
  {
    "id": 42,
    "empresa": "Acme Corp",
    "puesto": "Backend Engineer (Python)",
    "url": "https://jobs.ashbyhq.com/acme/abc123",
    "ats": "ashby",
    "descripcion": "texto completo de la vacante...",
    "salario_min": 60000, "salario_max": 90000, "moneda": "USD/año",
    "modalidad": "remoto LATAM"
  }
]
```

#### `POST /api/postulaciones`
El motor reporta el resultado de intentar postular.
```json
{
  "vacante_id": 42,
  "estado": "enviada",            // enviada | captcha_pendiente | error | saltada
  "cv_pdf": "data/cv/acme_42.pdf",
  "keywords_usadas": ["python","fastapi","aws","docker"],
  "captcha_link": null,           // si estado=captcha_pendiente: URL pre-llena para el tap de DarkN
  "screenshot": "data/shots/acme_42.png",
  "notas": "Formulario Ashby completo; sin captcha.",
  "fecha_envio": "2026-10-04T03:05:00Z"
}
```

#### `POST /api/vacantes`  (opcional)
Si el motor también descubre vacantes nuevas, las sube aquí (dedup por `url`).

#### `PATCH /api/postulaciones/<id>`
Para actualizar estado luego (ej. DarkN dio el tap del captcha -> `enviada`;
o llegó respuesta de la empresa -> `entrevista`/`rechazada`).

---

## Opción alternativa: acceso directo a la DB

Si el motor escribe directo (PostgreSQL recomendado), este es el esquema mínimo.

### Tabla `vacante`
| campo | tipo | notas |
|---|---|---|
| id | PK | |
| empresa | text | |
| puesto | text | |
| url | text UNIQUE | dedup |
| ats | text | ashby/greenhouse/lever/jazzhr/workday/generico |
| descripcion | text | para extraer keywords |
| salario_min / salario_max | int null | |
| moneda | text | "USD/año", "MXN/mes"... |
| modalidad | text | |
| fecha_detectada | timestamp | |

### Tabla `postulacion`
| campo | tipo | notas |
|---|---|---|
| id | PK | |
| vacante_id | FK -> vacante | |
| estado | text | por_postular / enviada / captcha_pendiente / error / saltada / vista / entrevista / oferta / rechazada |
| fecha_envio | timestamp null | |
| cv_pdf | text null | ruta del CV adaptado |
| keywords_usadas | json/text | |
| captcha_link | text null | URL pre-llena para el tap de DarkN |
| screenshot | text null | |
| notas | text | |

### Tabla `cv_generado`  (opcional, historial)
| campo | tipo | notas |
|---|---|---|
| id | PK | |
| vacante_id | FK | |
| ruta_pdf | text | |
| keywords_usadas | json | |
| fecha | timestamp | |

---

## Estados (máquina de estados de una postulación)

```
por_postular ──> (motor procesa)
                   ├── sin captcha ──> enviada
                   ├── con captcha ──> captcha_pendiente ──(DarkN da el tap)──> enviada
                   ├── falla ────────> error
                   └── no cumple ────> saltada

enviada ──(respuesta empresa)──> vista | entrevista | oferta | rechazada
```

---

## ➕ Ampliaciones implementadas (compatibles con lo anterior)

1. **Aprobación manual (regla dura #1):** las vacantes tienen `estado`:
   `nueva` → (DarkN aprueba en el panel) → `por_postular` → `procesada` | `descartada`.
   `POST /api/vacantes` las crea como `nueva`; `GET /api/vacantes/pendientes` solo devuelve
   `por_postular`. Al reportar `POST /api/postulaciones`, la vacante pasa a `procesada`.
2. **`POST /api/postulaciones` es upsert por `vacante_id`:** si el motor reintenta, actualiza
   (200) en vez de duplicar (201 la primera vez). Una postulación por vacante.
3. **Estados nuevos de postulación:** `vista` (la plataforma marcó "visto") y `oferta`.
4. **Eventos / correos:** `POST /api/eventos` registra correos recibidos/enviados, entrevistas
   y notas en la línea de tiempo, identificando la postulación por `postulacion_id`,
   `vacante_id`, `url` o `empresa_nombre`, y opcionalmente con `cambiar_estado`.
5. **Campos extra** (opcionales): Vacante `contrato`, `fuente`, `keywords`, `prioridad` (1-5);
   Postulación `brechas`, `proxima_accion`, `proximo_seguimiento`.
6. **`GET /api/stats`** para resúmenes; **`POST /api/postulaciones/registrar`** para
   postulaciones hechas a mano.
7. El campo `empresa` viaja como **texto** (nombre); el panel crea la empresa si no existe.

## Qué necesita GabyBot de DarkN cuando el panel esté listo

1. La **URL base** del panel (ej. `http://localhost:8000` o la del VPS/Tailscale).
2. El **token** de API (por canal seguro, no en chat público).
3. Confirmar si va por **API** (recomendado) o **DB directa** (y credenciales si es DB).
