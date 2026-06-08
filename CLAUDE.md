# DS-Online Project

## Repository Layout

This project spans two sibling directories under `/Users/max/repo_claude/`:

### Frontend (this repo)
- `/Users/max/repo_claude/DS-Online/` — Vue/JS frontend

### Backend
- `/Users/max/repo_claude/web_slicer_core/agent/` — Python FastAPI backend (uvicorn agent.main:app)
  - `main.py` — App entrypoint
  - `api_v2.py` — V2 API routes
  - `sla_operations.py` — SLA/ortho processing logic
  - `jobs.py` — Job management
  - `models.py` — Pydantic models
  - `config.py` — Configuration
  - `jobs/` — Job data directory

### PrusaSlicer (C++ lib)
- `/Users/max/repo_claude/web_slicer_core/third_party/prusaslicer_fork/` — Forked PrusaSlicer source
- `/Users/max/repo_claude/web_slicer_core/third_party/prusaslicer_build/` — PrusaSlicer build output
