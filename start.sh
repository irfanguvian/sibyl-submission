#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Single-container boot: migrate DB, start backend (internal :3001), then start
# the Next.js frontend on the public $PORT. Exits (so Railway restarts) if
# either process dies.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PUBLIC_PORT="${PORT:-3000}"   # Railway injects PORT; falls back to 3000 locally
BACKEND_PORT=3001

# 1) Apply pending Prisma migrations (idempotent — safe on every boot).
echo "[start] prisma migrate deploy"
( cd /app/backend && node_modules/.bin/prisma migrate deploy )

# 2) Backend on an internal port only the Next server reaches over localhost.
echo "[start] backend → 127.0.0.1:${BACKEND_PORT}"
( cd /app/backend && PORT="${BACKEND_PORT}" node dist/main ) &
BACKEND_PID=$!

# 3) Wait until the backend answers before exposing the frontend.
echo "[start] waiting for backend health…"
for _ in $(seq 1 30); do
  if node -e "fetch('http://127.0.0.1:${BACKEND_PORT}/docs-json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "[start] backend healthy"
    break
  fi
  if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
    echo "[start] backend exited during startup" >&2
    exit 1
  fi
  sleep 1
done

# 4) Frontend on the public port. Next standalone respects PORT + HOSTNAME.
echo "[start] frontend → 0.0.0.0:${PUBLIC_PORT}"
( cd /app/frontend && HOSTNAME=0.0.0.0 PORT="${PUBLIC_PORT}" node server.js ) &
FRONTEND_PID=$!

# 5) If either process exits, tear the container down so Railway restarts it.
wait -n
echo "[start] a process exited — shutting down" >&2
kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
exit 1
