# Proxy nginx compartido (VPS)

Un solo nginx publica 80/443 para todos los proyectos del VPS. Cada proyecto entra a la
red Docker externa `proxy` con un alias (Job Machine: `jobmachine-web`) y aquí tiene su `server{}`.

En el VPS vive en `/opt/proxy` (copia de esta carpeta). Recargar: `docker compose exec nginx nginx -s reload`.

## Activar HTTPS para un dominio (FASE 2)

1. DNS: registro `A` del dominio -> IP del VPS. Comprobar: `dig +short DOMINIO`.
2. Emitir certificado (el server de :80 ya sirve `/.well-known/acme-challenge/`):
   ```bash
   cd /opt/proxy
   docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
     -d DOMINIO --email TU_EMAIL --agree-tos --no-eff-email
   ```
3. `sed "s/DOMINIO/tu.dominio.com/g" jobmachine.ssl.conf.example > conf.d/jobmachine.conf`
   y `docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload`.
4. En `/opt/job-machine/.env`: dominio en `DJANGO_ALLOWED_HOSTS` y
   `DJANGO_CSRF_TRUSTED_ORIGINS=https://DOMINIO`, `DJANGO_SECURE_COOKIES=1`, y
   `docker compose -f docker-compose.prod.yml up -d`.
5. Renovación: cron diario (lo instala el setup)
   `cd /opt/proxy && docker compose run --rm certbot renew -q && docker compose exec nginx nginx -s reload`.

## Añadir otro proyecto

En su compose: servicio en la red externa `proxy` con un alias único, sin `ports:`.
Aquí: un `conf.d/<proyecto>.conf` con su `server_name` y `proxy_pass http://<alias>:<puerto>`.
