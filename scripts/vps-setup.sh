#!/usr/bin/env bash
# Preparación inicial del VPS (Ubuntu 22.04/24.04). Idempotente; ejecutar como root:
#   curl -fsSL https://raw.githubusercontent.com/darkn-code/job-machine/main/scripts/vps-setup.sh | sudo bash
# Hace: Docker, firewall (22/80/443), fail2ban, swap (si RAM < 2 GB), actualizaciones automáticas,
# usuario `deploy` (GitHub Actions), red Docker `proxy`, nginx-proxy compartido en /opt/proxy,
# clon del repo en /opt/job-machine y crons (backup diario + renovación de certificados).
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/job-machine}"
PROXY_DIR="${PROXY_DIR:-/opt/proxy}"
REPO_URL="${REPO_URL:-https://github.com/darkn-code/job-machine.git}"

[ "$(id -u)" = 0 ] || { echo "Ejecuta como root"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> Paquetes base"
apt-get update -y
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now fail2ban

echo "==> Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker

echo "==> Usuario $DEPLOY_USER (deploys de GitHub Actions)"
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
# El usuario que ejecuta sudo también puede usar docker
[ -n "${SUDO_USER:-}" ] && usermod -aG docker "$SUDO_USER"

echo "==> Swap"
if [ "$(free -m | awk '/Mem:/ {print $2}')" -lt 2000 ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Repo en $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR/backups"

echo "==> Red Docker 'proxy' + nginx compartido en $PROXY_DIR"
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
if [ ! -d "$PROXY_DIR" ]; then
  cp -r "$APP_DIR/infra/proxy" "$PROXY_DIR"
fi
install -d "$PROXY_DIR/certbot/www" "$PROXY_DIR/certbot/conf"
# VPS nuevo sin certificado todavía: arrancar con la versión HTTP (ver infra/proxy/README.md)
if [ ! -d "$PROXY_DIR/certbot/conf/live/job-machine.darkn-47.com" ]; then
  cp "$PROXY_DIR/jobmachine.http.conf.example" "$PROXY_DIR/conf.d/jobmachine.conf"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$PROXY_DIR"
(cd "$PROXY_DIR" && docker compose up -d)

echo "==> Crons (backup 04:00, certificados 03:30)"
( crontab -u "$DEPLOY_USER" -l 2>/dev/null | grep -vE 'backup.sh|certbot' || true
  echo "0 4 * * * $APP_DIR/scripts/backup.sh >> $APP_DIR/backups/cron.log 2>&1"
  echo "30 3 * * * cd $PROXY_DIR && docker compose run --rm certbot renew -q && docker compose exec -T nginx nginx -s reload"
) | crontab -u "$DEPLOY_USER" -

cat <<NEXT

Listo. Siguientes pasos (detalle en docs/DEPLOY.md):
  1. Llave pública de GitHub Actions -> /home/$DEPLOY_USER/.ssh/authorized_keys
  2. $APP_DIR/.env (cp .env.example .env) con secretos nuevos
  3. Primer deploy: Actions -> CI/CD -> Run workflow (o ./scripts/deploy.sh latest como $DEPLOY_USER)
NEXT
