#!/bin/bash
# R&D Research Engine — One-click launcher
# Starts everything: Docker infra, ML service, ingestion worker, web app.
# Safe to run repeatedly. Press Ctrl+C to shut everything down cleanly.

set -e

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
LOG_DIR="$PROJECT_DIR/.runtime-logs"
mkdir -p "$LOG_DIR"

# ─── Colors ───
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; N='\033[0m'

banner() {
  echo ""
  echo -e "${B}========================================${N}"
  echo -e "${B}  $1${N}"
  echo -e "${B}========================================${N}"
}

ok()   { echo -e "${G}✓${N} $1"; }
info() { echo -e "${Y}→${N} $1"; }
err()  { echo -e "${R}✗${N} $1"; }

# ─── Cleanup on exit ───
WORKER_PID=""
WEB_PID=""
cleanup() {
  echo ""
  banner "Shutting down"
  [ -n "$WEB_PID" ]    && kill $WEB_PID 2>/dev/null && ok "Stopped Next.js"
  [ -n "$WORKER_PID" ] && kill $WORKER_PID 2>/dev/null && ok "Stopped ingestion worker"
  info "Docker containers left running. Stop them with: docker compose down"
  exit 0
}
trap cleanup SIGINT SIGTERM

banner "R&D Research Engine — Starting Up"

# ─── Step 1: Docker ───
info "Checking Docker..."
if ! command -v docker &>/dev/null; then
  err "Docker is not installed. Install Docker Desktop from https://docker.com"
  exit 1
fi
if ! docker info &>/dev/null 2>&1; then
  info "Docker not running. Starting Docker Desktop (this takes ~30s)..."
  open -a Docker
  while ! docker info &>/dev/null 2>&1; do sleep 2; done
fi
ok "Docker is running"

# ─── Step 2: .env ───
if [ ! -f .env ]; then
  cp .env.example .env
  ok "Created .env from .env.example"
  info "Edit .env to add ANTHROPIC_API_KEY for AI synthesis on PUBLIC documents"
else
  ok ".env exists"
fi

# ─── Step 3: Infrastructure services ───
info "Starting infrastructure (PostgreSQL, Redis, Qdrant, MinIO)..."
docker compose up -d postgres redis qdrant minio minio-init >/dev/null 2>&1
info "Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U rdengine &>/dev/null; do sleep 1; done
ok "PostgreSQL ready (port 5433)"
ok "Redis ready (port 6379)"
ok "Qdrant ready (port 6333)"
ok "MinIO ready (port 9000, console 9001)"

# ─── Step 4: Node dependencies ───
if [ ! -d node_modules ]; then
  info "Installing Node dependencies (first run, takes ~30s)..."
  npm install --silent 2>&1 | tail -3
  ok "Dependencies installed"
else
  ok "Node dependencies present"
fi

# ─── Step 5: Database migrations + seed ───
info "Applying Prisma schema..."
npx prisma generate >/dev/null 2>&1
npx prisma db push --skip-generate >/dev/null 2>&1
ok "Schema in sync"

info "Seeding database (idempotent)..."
npx prisma db seed >/dev/null 2>&1 || true
ok "Seed complete"

# ─── Step 6: ML service ───
# Only rebuild if the image doesn't exist or the user explicitly asks for it.
# Set REBUILD_ML=1 in your environment to force a rebuild.
if docker image inspect rd-ml-service:latest >/dev/null 2>&1 && [ "${REBUILD_ML:-0}" != "1" ]; then
  info "ML service image exists — starting without rebuild (set REBUILD_ML=1 to force rebuild)"
  docker compose up -d ml-service >/dev/null 2>&1
else
  info "Building ML service image (first build takes 5–15 min — live progress below):"
  echo ""
  docker compose build ml-service
  echo ""
  info "Starting ML service container..."
  docker compose up -d ml-service >/dev/null 2>&1
fi

info "Waiting for ML service health check..."
ATTEMPTS=0
until curl -s http://localhost:8000/health &>/dev/null; do
  sleep 2
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $((ATTEMPTS % 10)) -eq 0 ]; then
    info "  Still loading embedding model... (${ATTEMPTS}0s elapsed)"
  fi
  if [ $ATTEMPTS -gt 90 ]; then
    err "ML service didn't respond in 3 minutes. Check: docker logs rd-ml-service-1"
    exit 1
  fi
done
ok "ML service ready (port 8000)"

# ─── Step 7: Ingestion worker (background) ───
info "Starting ingestion worker..."
npm run worker > "$LOG_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 2
if ! kill -0 $WORKER_PID 2>/dev/null; then
  err "Worker failed to start. Check $LOG_DIR/worker.log"
  exit 1
fi
ok "Worker running (PID $WORKER_PID, logs: .runtime-logs/worker.log)"

# ─── Step 8: Next.js web app (background) ───
info "Starting Next.js web app..."
npm run dev > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!

info "Waiting for web app to compile..."
ATTEMPTS=0
until curl -s http://localhost:3000 &>/dev/null; do
  sleep 1
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $ATTEMPTS -gt 60 ]; then
    err "Web app failed to start. Check $LOG_DIR/web.log"
    exit 1
  fi
done
ok "Web app ready (PID $WEB_PID, logs: .runtime-logs/web.log)"

# ─── Step 9: Open browser ───
sleep 1
open "http://localhost:3000"

# ─── Final banner ───
banner "All systems running"
echo ""
echo -e "  ${G}App:${N}        http://localhost:3000"
echo -e "  ${G}ML API:${N}     http://localhost:8000/health"
echo -e "  ${G}MinIO UI:${N}   http://localhost:9001  (minioadmin / minioadmin)"
echo -e "  ${G}Qdrant UI:${N}  http://localhost:6333/dashboard"
echo ""
echo -e "  ${B}Login:${N}      admin@dhsecheron.com  /  admin123"
echo -e "                researcher@dhsecheron.com  /  researcher123"
echo ""
echo -e "  ${Y}Live logs:${N}  tail -f .runtime-logs/web.log .runtime-logs/worker.log"
echo -e "  ${Y}Stop:${N}       Press Ctrl+C in this window (Docker stays running)"
echo -e "  ${Y}Full stop:${N}  docker compose down"
echo ""
banner "Tailing web app logs (Ctrl+C to stop)"
echo ""

# Tail web logs in foreground; on Ctrl+C, cleanup() runs
tail -f "$LOG_DIR/web.log"
