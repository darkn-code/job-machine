#!/usr/bin/env bash
# Preparación inicial del VPS (Ubuntu 22.04/24.04). Ejecutar UNA vez como root:
#   curl -fsSL https://raw.githubusercontent.com/<usuario>/<repo>/main/scripts/vps-setup.sh -o vps-setup.sh
#   DOMAIN=panel.tu-dominio.com bash vps-setup.sh
# Hace: Docker, usuario `deploy`, firewall, fail2ban, swap (si RAM < 2 GB),
# actualizaciones automáticas, Caddy con HTTPS (si das DOMAIN) y cron de backups.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/job-machine}"
DOMAIN="${DOMAIN:-}"

[ "$(id -u)" = 0 ] || { echo "Ejecuta como root"; exit 1; }

echo "==> Paquetes base"
apt-get update -y
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

echo "==> Usuario $DEPLOY_USER"
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

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

if [ -n "$DOMAIN" ]; then
  echo "==> Caddy (HTTPS automático) para $DOMAIN -> localhost:8080"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
  cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    encode gzip
    reverse_proxy localhost:8080
}
CADDY
  systemctl reload caddy
fi

echo "==> Cron de backup diario (04:00)"
( crontab -u "$DEPLOY_USER" -l 2>/dev/null | grep -v backup.sh; \
  echo "0 4 * * * $APP_DIR/scripts/backup.sh >> $APP_DIR/backups/cron.log 2>&1" ) | crontab -u "$DEPLOY_USER" -

cat <<NEXT

Listo. Siguientes pasos (detalle en docs/DEPLOY.md):
  1. Pega la llave pública de deploy en /home/$DEPLOY_USER/.ssh/authorized_keys
  2. Como $DEPLOY_USER: git clone <repo> $APP_DIR && cd $APP_DIR && cp .env.example .env && nano .env
     (con dominio: HTTP_PORT=8080, DJANGO_SECURE_COOKIES=1, dominio en ALLOWED_HOSTS/CSRF)
  3. Recomendado: PasswordAuthentication no en /etc/ssh/sshd_config (después de probar la llave)
NEXT
