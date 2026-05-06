#!/usr/bin/env bash

set -euo pipefail

# Run ordered PostgreSQL migrations against Render database.
# Usage examples:
#   ./scripts/run_render_migrations.sh --seed-mode seed
#   ./scripts/run_render_migrations.sh --seed-mode actualizar --run-fix-constraints
#   ./scripts/run_render_migrations.sh --seed-mode seed --run-notificaciones --run-fix-documentos

SEED_MODE="seed"
RUN_FIX_CONSTRAINTS=false
RUN_NOTIFICACIONES=false
RUN_FIX_DOCUMENTOS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed-mode)
      SEED_MODE="${2:-}"
      shift 2
      ;;
    --run-fix-constraints)
      RUN_FIX_CONSTRAINTS=true
      shift
      ;;
    --run-notificaciones)
      RUN_NOTIFICACIONES=true
      shift
      ;;
    --run-fix-documentos)
      RUN_FIX_DOCUMENTOS=true
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/run_render_migrations.sh [options]

Options:
  --seed-mode <seed|actualizar>  Select final seed script (default: seed)
  --run-fix-constraints          Run optional fix_constraints_fecha.sql
  --run-notificaciones           Run notificaciones.sql (only after trigger/function fix)
  --run-fix-documentos           Run optional fix_documentos_no_pdf.sql
  -h, --help                     Show this help

Required env vars:
  PGHOST, PGPORT, PGUSER, PGDATABASE
Optional env vars:
  PGPASSWORD, PGSSLMODE (defaults to require)
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage."
      exit 1
      ;;
  esac
done

if [[ "$SEED_MODE" != "seed" && "$SEED_MODE" != "actualizar" ]]; then
  echo "Invalid --seed-mode value: $SEED_MODE"
  echo "Allowed values: seed | actualizar"
  exit 1
fi

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGDATABASE:?PGDATABASE is required}"

export PGSSLMODE="${PGSSLMODE:-require}"

if [[ -z "${PGPASSWORD:-}" ]]; then
  read -r -s -p "PostgreSQL password for ${PGUSER}: " PGPASSWORD
  echo
  export PGPASSWORD
fi

run_sql() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing SQL file: $file"
    exit 1
  fi

  echo "------------------------------------------------------------"
  echo "Running: $file"
  psql -v ON_ERROR_STOP=1 -f "$file"
}

echo "Starting migration sequence against ${PGDATABASE}@${PGHOST}:${PGPORT}"

action_start_time=$(date +%s)

run_sql "scripts/escala_adn_database.sql"
run_sql "scripts/bitacora_estrategica.sql"
run_sql "scripts/pagos_personal.sql"
run_sql "scripts/documentos_personal.sql"
run_sql "scripts/perfil_auditoria_sesiones.sql"
run_sql "scripts/sprint_numeracion_pagada.sql"

if [[ "$RUN_FIX_CONSTRAINTS" == true ]]; then
  run_sql "scripts/fix_constraints_fecha.sql"
else
  echo "Skipping optional: scripts/fix_constraints_fecha.sql"
fi

if [[ "$RUN_NOTIFICACIONES" == true ]]; then
  run_sql "scripts/notificaciones.sql"
else
  echo "Skipping conditional: scripts/notificaciones.sql (use --run-notificaciones after trigger/function fix)"
fi

if [[ "$SEED_MODE" == "seed" ]]; then
  run_sql "scripts/seed_usuario_ti.sql"
else
  run_sql "scripts/actualizar_usuario_ti.sql"
fi

if [[ "$RUN_FIX_DOCUMENTOS" == true ]]; then
  run_sql "scripts/fix_documentos_no_pdf.sql"
else
  echo "Skipping optional: scripts/fix_documentos_no_pdf.sql"
fi

echo "------------------------------------------------------------"
echo "Running Node migration: scripts/migrate-seed-hash.mjs"
node "scripts/migrate-seed-hash.mjs"

end_time=$(date +%s)
duration=$((end_time - action_start_time))

echo "------------------------------------------------------------"
echo "Migration flow completed successfully in ${duration}s."
