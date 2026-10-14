#!/bin/sh
# Start im Container: Datenbank aktualisieren, optional Beispieldaten und ersten Administrator anlegen, Server starten.
set -e
cd /app

echo "› Datenbank-Migrationen …"
node_modules/.bin/prisma migrate deploy

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "› Beispieldaten (nur wenn die Datenbank leer ist) …"
  node_modules/.bin/tsx prisma/seed.ts
fi

if [ -n "${ADMIN_EMAIL:-}" ]; then
  echo "› Administrator ${ADMIN_EMAIL} …"
  # Ein Tippfehler in ADMIN_EMAIL soll den Start nicht verhindern
  node_modules/.bin/tsx scripts/create-admin.ts --email "${ADMIN_EMAIL}" --name "${ADMIN_NAME:-Administrator}" --if-missing \
    || echo "  Administrator wurde nicht angelegt – ADMIN_EMAIL in docker.env prüfen."
fi

echo "› Starte Hertlin auf Port ${PORT:-3000} (Hauptdomain: ${ROOT_DOMAIN:-nicht gesetzt})"
exec node_modules/.bin/tsx server.ts
