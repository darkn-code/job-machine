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
`scripts/vps-setup.sh`, `infra/proxy/`, `docker-compose.prod.yml`, `.gitleaks.toml`, `.github/dependabot.yml`.

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

1. Repo: `github.com/darkn-code/job-machine` (público — por eso todo lo personal va en `.gitignore`):
   ```bash
   git remote add origin git@github.com:<usuario>/job-machine.git
   git push -u origin main
   ```
2. Con eso ya corre **CI** (tests, typecheck, build, gitleaks) y en `main` se publican las imágenes en GHCR.
   El job `deploy` queda **saltado** hasta que actives `DEPLOY_ENABLED`.
3. Recomendado: *Settings → Branches → Add rule* para `main`: exigir que pasen los checks
   (`Backend`, `Frontend`, `Escaneo de secretos`) antes de mergear.

## 🖥️ VPS (configurado 2026-10-04)

VPS: Ubuntu 24.04, 4 vCPU, 8 GB. Arquitectura:

```
Internet :80/:443 ──► /opt/proxy  (nginx compartido + certbot, red Docker `proxy`)
                          │ proxy_pass http://jobmachine-web:80
                          ▼
                     /opt/job-machine (docker-compose.prod.yml, sin puertos publicados)
                       web (nginx SPA) ──► backend (gunicorn) ──► db (Postgres, red interna)
```

1. **Setup** (root, idempotente): `curl -fsSL https://raw.githubusercontent.com/darkn-code/job-machine/main/scripts/vps-setup.sh | sudo bash`
   Docker, firewall (22/80/443), fail2ban, actualizaciones automáticas, usuario `deploy`,
   red `proxy`, nginx compartido, clon del repo y crons (backup 04:00, renovación de certificados).
2. **`.env`** en `/opt/job-machine` (secretos generados en el propio VPS, nunca salen de ahí):
   `IMAGE_REGISTRY=ghcr.io/darkn-code`, `DJANGO_ALLOWED_HOSTS` y `DJANGO_CSRF_TRUSTED_ORIGINS`
   con la IP/dominio (+ `localhost,127.0.0.1,backend`; `127.0.0.1` lo usa el healthcheck).
3. **Llave de deploy**: par ed25519 solo para GitHub Actions; la pública en
   `/home/deploy/.ssh/authorized_keys`, la privada en el secret `VPS_SSH_KEY`.
4. **GitHub → Settings → Secrets and variables → Actions**:

   | tipo | nombre | valor |
   |---|---|---|
   | Secret | `VPS_SSH_KEY` | llave privada de deploy |
   | Secret | `VPS_KNOWN_HOSTS` | salida de `ssh-keyscan -H <ip>` |
   | Variable | `VPS_HOST` | IP del VPS |
   | Variable | `VPS_USER` | `deploy` |
   | Variable | `VPS_APP_DIR` | `/opt/job-machine` |
   | Variable | `APP_URL` | URL pública |
   | Variable | `DEPLOY_ENABLED` | `true` |

5. **Dominio + HTTPS**: pasos en [`infra/proxy/README.md`](../infra/proxy/README.md).
6. **Seed opcional** (historial real, no está en el repo ni en la imagen): `scp postulaciones.json deploy@<vps>:~` y
   `docker compose -f docker-compose.prod.yml exec -T backend python manage.py seed --archivo /dev/stdin < ~/postulaciones.json`.
7. **Token de GabyBot**: `docker compose -f docker-compose.prod.yml exec backend python manage.py create_bot_token`.

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
