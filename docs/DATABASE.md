# 🗄️ Base de datos — Job Machine

PostgreSQL 16 · app Django `tracker` (`web/backend/tracker/models.py`).
Los diagramas son Mermaid: GitHub los dibuja solos.

## Diagrama entidad-relación

```mermaid
erDiagram
    EMPRESA ||--o{ VACANTE : "publica"
    VACANTE ||--o| POSTULACION : "se postula (1 a 1)"
    VACANTE ||--o{ CV_GENERADO : "CVs adaptados"
    POSTULACION ||--o{ EVENTO : "línea de tiempo"
    AUTH_USER ||--o| AUTHTOKEN_TOKEN : "token API"

    EMPRESA {
        bigint id PK
        varchar nombre UK "200"
        varchar web
        text notas
        timestamptz creado
    }

    VACANTE {
        bigint id PK
        bigint empresa_id FK
        varchar puesto "300"
        varchar url UK "nullable, evita duplicados"
        varchar ats "auto por dominio de la url"
        text descripcion
        int salario_min
        int salario_max
        varchar moneda
        varchar modalidad
        varchar contrato
        varchar fuente
        jsonb keywords "lista"
        smallint prioridad "1 max - 5 min"
        varchar estado "nueva | por_postular | procesada | descartada"
        timestamptz fecha_detectada
    }

    POSTULACION {
        bigint id PK
        bigint vacante_id FK,UK "OneToOne"
        varchar estado "ver diagrama de estados"
        timestamptz fecha_envio "se pone sola al pasar a enviada"
        varchar cv_pdf
        jsonb keywords_usadas
        varchar captcha_link
        varchar screenshot
        text notas
        text brechas
        varchar proxima_accion
        timestamptz proximo_seguimiento
        timestamptz creado
        timestamptz actualizado
    }

    EVENTO {
        bigint id PK
        bigint postulacion_id FK
        varchar tipo "correo_recibido | correo_enviado | cambio_estado | entrevista | nota"
        varchar titulo
        varchar remitente
        text contenido
        varchar estado_anterior
        varchar estado_nuevo
        varchar actor "darkn | gabybot | sistema | seed"
        timestamptz fecha
    }

    CV_GENERADO {
        bigint id PK
        bigint vacante_id FK
        varchar ruta_pdf
        jsonb keywords_usadas
        timestamptz fecha
    }

    AUTH_USER {
        int id PK
        varchar username UK "darkn (admin) | gabybot (sin password)"
        bool is_staff
        bool is_superuser
    }

    AUTHTOKEN_TOKEN {
        varchar key PK "Authorization: Token <key>"
        int user_id FK,UK
        timestamptz created
    }
```

Borrados en cascada: borrar una **Empresa** borra sus vacantes → postulaciones → eventos y CVs.

`AUTH_USER`/`AUTHTOKEN_TOKEN` son tablas de Django (simplificadas aquí); no se relacionan con el
tracker por FK: el usuario que hace un cambio queda como texto en `Evento.actor`.

## Flujo de una vacante

```mermaid
flowchart LR
    A["GabyBot / DarkN<br/>POST /api/vacantes"] --> N[nueva<br/><i>por revisar</i>]
    N -- "DarkN aprueba<br/>/aprobar" --> P[por_postular]
    N -- "/descartar" --> D[descartada]
    P -- "GET /api/vacantes/pendientes<br/>(el motor SOLO toma estas)" --> M{{motor}}
    M -- "POST /api/postulaciones/registrar" --> PR[procesada]
    PR -.-> POST[(Postulacion)]
```

## Estados de una postulación

Cada cambio de estado crea automáticamente un `Evento` (`tipo=cambio_estado`, con `actor`).

```mermaid
stateDiagram-v2
    [*] --> por_postular
    por_postular --> enviada : el motor envía
    por_postular --> captcha_pendiente : hay captcha (DarkN da el tap)
    por_postular --> error
    por_postular --> saltada
    captcha_pendiente --> enviada : DarkN completa
    error --> por_postular : reintento
    enviada --> vista : la empresa la abre
    enviada --> rechazada
    vista --> entrevista
    vista --> rechazada
    entrevista --> oferta
    entrevista --> rechazada
    oferta --> [*]
    rechazada --> [*]
    saltada --> [*]
```

| grupo (para las estadísticas) | estados |
|---|---|
| **Enviadas** | enviada, vista, entrevista, oferta, rechazada |
| **Con respuesta** | vista, entrevista, oferta, rechazada |
| **Activas** | enviada, vista, entrevista, oferta, captcha_pendiente |

El panel permite mover entre cualquier estado (Kanban); el diagrama muestra el camino normal.

## Ver la base real

```bash
# Consola SQL en producción
ssh darkn@158.220.126.87
cd /opt/job-machine && sudo -u deploy docker compose -f docker-compose.prod.yml exec db \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
#   \dt tracker_*            tablas
#   \d tracker_postulacion   columnas e índices
```

También: Django admin en `/admin/` y la API documentada en `/api/docs` (Swagger).
