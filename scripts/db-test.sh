#!/usr/bin/env bash
# Crea una base de datos local desechable, aplica las migraciones sobre una
# simulación mínima de Supabase y ejecuta las pruebas de RLS.
# Requiere PostgreSQL 15+ local. Variables opcionales: PGHOST, PGPORT, PGUSER.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="asistente_test_$$"
PSQL=(psql -v ON_ERROR_STOP=1 -X -q)

if [ "$(id -u)" = "0" ] && [ -z "${PGUSER:-}" ]; then
  PSQL=(sudo -u postgres "${PSQL[@]}")
  CREATEDB=(sudo -u postgres createdb)
  DROPDB=(sudo -u postgres dropdb)
else
  CREATEDB=(createdb)
  DROPDB=(dropdb)
fi

"${CREATEDB[@]}" "$DB"
trap '"${DROPDB[@]}" --if-exists "$DB"' EXIT

"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/tests/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Aplicando $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
"${PSQL[@]}" -d "$DB" -o /dev/null -f "$ROOT/supabase/tests/rls_test.sql" 2>&1 | sed 's/^psql:[^:]*:[0-9]*: //'
