# ⚙️ Diseño del motor (`engine/`)

Lo construye **GabyBot** cuando DarkN dé luz verde. Aquí queda el diseño acordado
para no re-discutirlo.

## Stack
- **Playwright** (Node) para automatizar formularios.
- **playwright-extra + plugin stealth** (GRATIS) para reducir detección anti-bot.
- **Docker** para aislar y correr headless con la PC bloqueada.
- Reusa los scripts ya probados en el workspace de OpenClaw:
  `scripts\bydrec-apply.mjs`, `optery-apply.mjs`, `glacier-apply.mjs`.

## Flujo de un lote (`run-batch.mjs`)
```
1. Pedir N vacantes "por_postular" al panel (API) o leer cola local.
2. Por cada vacante:
   a. detect-ats(url)          -> qué módulo usar
   b. adapt-cv(master, desc)   -> CV PDF optimizado a keywords
   c. apply/<ats>(vacante, cv) -> abrir, llenar campos, subir CV
   d. captcha-guard()          -> ¿hay captcha?
        - no  -> submit -> estado "enviada"
        - sí  -> NO submit -> screenshot + link -> estado "captcha_pendiente"
   e. reportar resultado al panel (POST /api/postulaciones)
3. Resumen del lote -> avisar a DarkN por Telegram.
```

## Reglas de seguridad (duras)
- **Lotes pequeños** al inicio (2-3) para afinar.
- **Nunca** resolver captcha con servicios de pago (decisión DarkN).
- Con captcha -> **no enviar**, dejar listo para el tap de DarkN.
- Datos personales solo al formulario de la vacante; nunca a terceros.

## Por qué Docker funciona con la PC bloqueada
Chromium corre headless dentro del contenedor con su propia pantalla virtual.
No depende del escritorio de Windows ni de sesión desbloqueada. La PC solo debe
estar **encendida** con Docker arriba. Esto ya encaja con el flujo de madrugada
(Lidia enciende por WoL).

## Detección de ATS (dominios)
| ATS | dominio | notas |
|---|---|---|
| Ashby | jobs.ashbyhq.com | ya probado (Optery) |
| JazzHR | *.applytojob.com | ya probado (Bydrec) |
| Greenhouse | boards.greenhouse.io, job-boards.greenhouse.io | muy común |
| Lever | jobs.lever.co | común |
| Workday | *.myworkdayjobs.com | pide cuenta; el más pesado |
| Genérico | (fallback) | heurística de campos |

## Pendiente de afinar (notas para cuando se construya)
- Si el stealth headless se detecta mucho -> headful con Xvfb en el contenedor.
- Caché del perfil del navegador (como `.pw-chrome`) para no re-loguear cada vez.
- Rate limit entre postulaciones (no parecer bot; espaciar envíos).
