# BhuRaksha × RESQ.AI Platform Makefile
SHELL := /bin/bash
VENV_PYTHON := .venv/bin/python3
VENV_PYTEST := .venv/bin/pytest
NODE_PATH ?= /home/aero/.nvm/versions/node/v24.15.0/bin

.PHONY: all help seed test demo build verify up twin sim-validate down

all: verify

AOI ?= gangtok

help:
	@echo "BhuRaksha × RESQ.AI Operational Platform Commands:"
	@echo "  make up           - Launch complete project: FastAPI backend (8000) and Vite frontend (3000)"
	@echo "  make down         - Stop any running backend and frontend processes"
	@echo "  make seed         - Seed default RBAC users and clean database"
	@echo "  make test         - Run full pytest test suite"
	@echo "  make twin AOI=... - Build digital twin bundle for AOI (default: gangtok)"
	@echo "  make sim-validate - Run physical simulation validation suite"
	@echo "  make demo         - Run deterministic end-to-end demo runner in <3 minutes"
	@echo "  make build        - Build React + Three.js frontend distribution"
	@echo "  make verify       - Run full test suite, build frontend, and execute demo"

seed:
	PYTHONPATH=. $(VENV_PYTHON) -c "import asyncio; from backend.app.db.database import db; from backend.app.db.seed import seed_users; asyncio.run(db.init()); asyncio.run(seed_users())"

test:
	PYTHONPATH=. $(VENV_PYTEST) -v backend/tests/

demo:
	PYTHONPATH=. $(VENV_PYTHON) scripts/demo.py

validate:
	PYTHONPATH=. $(VENV_PYTHON) scripts/run_validation.py

terrain-tiles:
	PYTHONPATH=. $(VENV_PYTHON) scripts/build_terrain_tiles.py $(AOI)

twin:
	PYTHONPATH=. $(VENV_PYTHON) scripts/build_twin.py $(AOI)

sim-validate:
	PYTHONPATH=. $(VENV_PYTHON) scripts/run_sim_validation.py

build:
	export PATH="$(NODE_PATH):$$PATH" && cd apps/web && npm run build

verify: test build validate demo
	@echo "════════════════════════════════════════════════════════════════"
	@echo "  ALL VERIFICATION GATES PASSED: SYSTEM PRODUCTION-READY        "
	@echo "════════════════════════════════════════════════════════════════"

down:
	@echo "Stopping BhuRaksha services on ports 8000 and 3000..."
	@fuser -k 8000/tcp 2>/dev/null || true
	@fuser -k 3000/tcp 2>/dev/null || true

up:
	@echo "Starting BhuRaksha backend and frontend..."
	@fuser -k 8000/tcp 2>/dev/null || true
	@fuser -k 3000/tcp 2>/dev/null || true
	export PATH="$(NODE_PATH):$$PATH" && \
	PYTHONPATH=. $(VENV_PYTHON) -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 & \
	BACKEND_PID=$$!; \
	trap 'kill $$BACKEND_PID 2>/dev/null || true; fuser -k 8000/tcp 2>/dev/null || true; fuser -k 3000/tcp 2>/dev/null || true' EXIT INT TERM; \
	cd apps/web && npm run dev
