#!/usr/bin/env bash
# Backup de Postgres -> backups/jobmachine_<fecha>.sql.gz (guarda los últimos 14 días).
# Cron diario sugerido (lo instala vps-setup.sh):  0 4 * * * /opt/job-machine/scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
compose="docker compose -f docker-compose.prod.yml"

[ -n "$($compose ps -q db 2>/dev/null)" ] || { echo "La DB no está corriendo"; exit 1; }

mkdir -p backups
out="backups/jobmachine_$(date +%F_%H%M).sql.gz"
$compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$out"
echo "Backup: $out ($(du -h "$out" | cut -f1))"
find backups -name 'jobmachine_*.sql.gz' -mtime +14 -delete

# Restaurar:
#   gunzip -c backups/<archivo>.sql.gz | docker compose -f docker-compose.prod.yml exec -T db \
#     sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
