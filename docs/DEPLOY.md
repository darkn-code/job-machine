# 🚢 Deploy y CI/CD — Job Machine

Flujo: **push a `main` → GitHub Actions prueba → publica imágenes en GHCR → el VPS las baja y reinicia**.
El VPS nunca compila (bien para un VPS chico de 1–2 GB).

```
 PR / push ──► secrets-scan (gitleaks) ─┐
               backend  (tests + PG16) ─┼─► images (solo main) ──► deploy (si DEPLOY_ENABLED)
               frontend (tsc + build)  ─┘    ghcr.io/<user>/job-machine-{backend,web}:<sha>|latest
                                                                   │ ssh deploy@VPS
                                                                   ▼
                                       scripts/deploy.sh <sha>: git checkout → backup DB → pull
                                       → up -d → healthcheck /api/health → (rollback si falla)
```

Archivos: `.github/workflows/ci-cd.yml`, `scripts/deploy.sh`, `scripts/backup.sh`,
`scripts/vps-setup.sh`, `docker-compose.prod.yml`, `.gitleaks.toml`, `.github/dependabot.yml`.

---

## 🔐 Qué NUNCA sube al repo (`.gitignore`)

| qué | dónde vive |
|---|---|
| CV (`cv-master/*`, salvo `master.example.md`), cualquier `*.pdf/*.docx/*.xlsx/*.csv` | solo en tu PC |
| Historial real (`web/backend/tracker/seed/postulaciones.json`) | tu PC (cópialo al VPS a mano si quieres el seed allá) |
| `.env` y cualquier `.env.*` (menos `.env.example`), llaves `*.pem/*.key`, `id_*` | PC / VPS |
| Backups (`backups/`, `*.sql*`), `*.sqlite3`, `engine/data/` | PC / VPS |

Red de seguridad: **gitleaks** corre en cada push/PR y falla si detecta un secreto.
Opcional en local (antes de cada commit): `gitleaks protect --staged --config .gitleaks.toml`.

> Si alguna vez se sube un secreto: **rótalo** (cambiar la clave), no basta con borrar el commit.

---

## ✅ Ahora (sin VPS todavía)

1. Crear el repo en GitHub (**privado** recomendado) y hacer push:
   ```bash
   git remote add origin git@github.com:<usuario>/job-machine.git
   git push -u origin main
   ```
2. Con eso ya corre **CI** (tests, typecheck, build, gitleaks) y en `main` se publican las imágenes en GHCR.
   El job `deploy` queda **saltado** hasta que actives `DEPLOY_ENABLED`.
3. Recomendado: *Settings → Branches → Add rule* para `main`: exigir que pasen los checks
   (`Backend`, `Frontend`, `Escaneo de secretos`) antes de mergear.

## 🖥️ Cuando compres el VPS

Recomendado: Ubuntu 24.04, **2 GB RAM** (1 GB funciona con swap), y un dominio/subdominio apuntando a su IP.

1. **Preparar el servidor** (como root):
   ```bash
   DOMAIN=panel.tu-dominio.com bash scripts/vps-setup.sh   # sube el script con scp o curl
   ```
   Instala Docker, crea el usuario `deploy`, firewall (22/80/443), fail2ban, swap, Caddy con HTTPS
   automático → `localhost:8080`, y cron de backup diario.

2. **Llave SSH solo para deploy** (en tu PC):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/jobmachine_deploy -N "" -C "github-actions-deploy"
   ```
   - Pública (`.pub`) → `/home/deploy/.ssh/authorized_keys` del VPS.
   - Privada → secret `VPS_SSH_KEY` en GitHub (y luego bórrala de tu PC si quieres).
   - `ssh-keyscan -H <ip-del-vps>` → secret `VPS_KNOWN_HOSTS` (evita ataques MITM).

3. **Clonar en el VPS** (como `deploy`). Si el repo es privado, añade una *Deploy key* de solo
   lectura (Settings → Deploy keys) generada en el VPS (`ssh-keygen -t ed25519`):
   ```bash
   git clone git@github.com:<usuario>/job-machine.git /opt/job-machine
   cd /opt/job-machine && cp .env.example .env && nano .env
   ```
   En `.env`: `DJANGO_SECRET_KEY` nueva, contraseñas fuertes, `IMAGE_REGISTRY=ghcr.io/<usuario-en-minúsculas>`,
   `HTTP_PORT=8080` (Caddy ocupa 80/443), `DJANGO_SECURE_COOKIES=1`,
   `DJANGO_ALLOWED_HOSTS=panel.tu-dominio.com,localhost,127.0.0.1,backend`,
   `DJANGO_CSRF_TRUSTED_ORIGINS=https://panel.tu-dominio.com`.
   (`127.0.0.1` es necesario: el healthcheck entra por ahí.)

4. **Seed opcional** (historial real, no está en el repo ni en la imagen). Después del primer deploy,
   copia el JSON al VPS (`scp postulaciones.json deploy@<vps>:~`) y cárgalo:
   `docker compose -f docker-compose.prod.yml exec -T backend python manage.py seed --archivo /dev/stdin < ~/postulaciones.json`
   (es idempotente). Pon `SEED_ON_START=0` en `.env`.

5. **GitHub → Settings → Secrets and variables → Actions**:

   | tipo | nombre | valor |
   |---|---|---|
   | Secret | `VPS_SSH_KEY` | llave privada de deploy |
   | Secret | `VPS_KNOWN_HOSTS` | salida de `ssh-keyscan -H <ip>` |
   | Variable | `VPS_HOST` | IP o dominio |
   | Variable | `VPS_USER` | `deploy` |
   | Variable | `VPS_PORT` | `22` (opcional) |
   | Variable | `VPS_APP_DIR` | `/opt/job-machine` (opcional) |
   | Variable | `APP_URL` | `https://panel.tu-dominio.com` |
   | Variable | `DEPLOY_ENABLED` | `true` ← enciende el deploy |

   Opcional: en *Settings → Environments → production* pide aprobación manual antes de cada deploy.

6. Primer deploy: *Actions → CI/CD → Run workflow* (o un push a `main`). Luego:
   ```bash
   docker compose -f docker-compose.prod.yml exec backend python manage.py create_bot_token   # token GabyBot
   ```

## 🔁 Operación

| tarea | cómo |
|---|---|
| Deploy | push/merge a `main` |
| Rollback | *Actions* → re-ejecutar un run viejo exitoso, o en el VPS `./scripts/deploy.sh <sha-anterior>` |
| Backup manual | `./scripts/backup.sh` (diario automático 04:00, guarda 14 días en `backups/`) |
| Restaurar | ver comentario al final de `scripts/backup.sh` |
| Logs | `docker compose -f docker-compose.prod.yml logs -f backend web` |
| Rotar token del bot | `... exec backend python manage.py create_bot_token --rotar` |

**Nota de rollback:** `deploy.sh` vuelve a las imágenes anteriores si el healthcheck falla, pero
las migraciones ya aplicadas no se revierten; el backup previo a cada deploy queda en `backups/`.

## 🧭 Siguientes mejoras (cuando haga falta)

- Backups fuera del VPS (rclone a Backblaze B2 / Google Drive) — hoy quedan en el mismo disco.
- Monitoreo de uptime gratis (UptimeRobot / healthchecks.io) a `https://<dominio>/api/health`.
- Imagen del motor (`engine/`) en el mismo pipeline cuando GabyBot lo construya.
- Entorno *staging* si el panel crece.
