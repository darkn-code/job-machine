#!/usr/bin/env bash
# Deploy en el VPS. Lo llama GitHub Actions por SSH (ver .github/workflows/ci-cd.yml):
#   echo "$GHCR_TOKEN" | ./scripts/deploy.sh <git-sha> <usuario-github>
# También sirve a mano:  ./scripts/deploy.sh latest
# Pasos: actualiza el repo al commit -> backup de la DB -> pull de imágenes -> up -> healthcheck.
# Si el healthcheck falla, vuelve al tag anterior (las migraciones NO se revierten: para eso está el backup).
set -euo pipefail

# Todo dentro de main(): bash lee la función completa antes de ejecutarla, así el
# `git checkout` de abajo puede reemplazar este archivo sin romper la ejecución en curso.
main() {
  local tag="${1:?uso: deploy.sh <tag> [usuario-ghcr]}"
  local ghcr_user="${2:-deploy}"
  cd "$(dirname "$0")/.."
  local compose="docker compose -f docker-compose.prod.yml"

  [ -f .env ] || { echo "Falta .env (cp .env.example .env y edítalo)"; exit 1; }

  # Token de GHCR por stdin (opcional: si las imágenes son públicas no hace falta)
  local logged_in=0
  if [ ! -t 0 ]; then
    local token; token="$(cat || true)"
    if [ -n "$token" ]; then
      echo "$token" | docker login ghcr.io -u "$ghcr_user" --password-stdin >/dev/null
      logged_in=1
    fi
  fi

  if [ "$tag" != "latest" ]; then
    echo "==> Repo al commit $tag"
    git fetch --quiet origin
    git checkout --quiet --detach "$tag"
  fi

  local prev; prev="$(grep -E '^IMAGE_TAG=' .env | cut -d= -f2- || true)"
  prev="${prev:-latest}"

  echo "==> Backup de la base"
  ./scripts/backup.sh || echo "(sin backup: ¿primer deploy?)"

  echo "==> Imágenes $tag (antes: $prev)"
  set_tag "$tag"
  if ! $compose pull backend web; then
    set_tag "$prev"; echo "!! No se pudieron bajar las imágenes"; exit 1
  fi
  [ "$logged_in" = 1 ] && docker logout ghcr.io >/dev/null || true

  $compose up -d --no-build --remove-orphans

  echo "==> Healthcheck"
  if wait_healthy; then
    echo "==> OK: desplegado $tag"
    docker image prune -af --filter "until=168h" >/dev/null || true
  else
    echo "!! Healthcheck falló; rollback a $prev"
    $compose logs --tail=80 backend web || true
    set_tag "$prev"
    $compose up -d --no-build
    exit 1
  fi
}

set_tag() {
  if grep -qE '^IMAGE_TAG=' .env; then
    sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$1|" .env
  else
    echo "IMAGE_TAG=$1" >> .env
  fi
}

wait_healthy() {
  local id status
  for _ in $(seq 1 40); do
    id="$(docker compose -f docker-compose.prod.yml ps -q web)"
    status="$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)"
    [ "$status" = "healthy" ] && return 0
    sleep 5
  done
  return 1
}

main "$@"
exit
