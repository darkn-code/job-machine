#!/bin/sh
set -e

# Espera a Postgres (el healthcheck de compose ya ayuda, esto es por si acaso).
python - <<'EOF'
import os, time, psycopg
if os.environ.get("POSTGRES_HOST"):
    for i in range(30):
        try:
            psycopg.connect(host=os.environ["POSTGRES_HOST"], dbname=os.environ.get("POSTGRES_DB"),
                            user=os.environ.get("POSTGRES_USER"), password=os.environ.get("POSTGRES_PASSWORD")).close()
            break
        except Exception:
            print("Esperando a Postgres..."); time.sleep(1)
EOF

python manage.py migrate --noinput
python manage.py ensure_admin
if [ "${SEED_ON_START:-1}" = "1" ]; then
  python manage.py seed
fi

exec "$@"
