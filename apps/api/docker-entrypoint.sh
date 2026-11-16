#!/bin/sh
# Safe start sequence: migrate, load reference data (roles, permissions, units, regions, categories, default contract templates; never demo data), then start the API.
set -eu

if [ ! -d prisma/migrations ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "ERROR: prisma/migrations is empty. Create the first migration locally with:"
  echo "  npx prisma migrate dev --name init"
  echo "then commit apps/api/prisma/migrations and redeploy. Refusing to start without migrations."
  exit 1
fi

echo "[entrypoint] applying database migrations (prisma migrate deploy)"
npx prisma migrate deploy

echo "[entrypoint] loading reference data"
node dist/scripts/seed-reference.js

echo "[entrypoint] starting API"
exec node dist/main.js
