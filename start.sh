#!/usr/bin/env bash
# Starts backend (8000) and frontend (3000) for local development. Run from the project root.
set -euo pipefail
cd "$(dirname "$0")"
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -f frontend/.env.local ] || cp frontend/.env.example frontend/.env.local
(cd backend && [ -d .venv ] || python3 -m venv .venv)
(cd backend && . .venv/bin/activate && pip install -q -r requirements.txt && python -m scripts.seed_sample && uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT
(cd frontend && npm install --no-audit --no-fund && npm run dev)
