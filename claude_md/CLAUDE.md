# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Donfra** is a full-stack educational/career mentorship platform with real-time collaborative coding capabilities. It's a monorepo with three main services:

- **donfra-api** (Go): REST API for room management, Python code execution, and lesson management
- **donfra-ws** (Node.js): WebSocket server for real-time collaborative editing using Yjs CRDT
- **donfra-ui** (Next.js): SSR frontend with Monaco editor, Excalidraw whiteboarding, and Framer Motion

## Common Commands

### Full Stack Development

```bash
# Start all services locally (Docker Compose)
make localdev-up

# Stop all services
make localdev-down

# Restart specific services
make localdev-restart-api
make localdev-restart-ws
make localdev-restart-ui
make localdev-restart-db
make localdev-restart-redis

# View logs from all services
make logs

# Check running containers
make ps
```

### Kubernetes (Kind) Local Development

```bash
# Setup Kind cluster with all services
make k8s-setup

# Teardown Kind cluster
make k8s-teardown

# Rebuild and reload Docker images (after code changes)
make k8s-rebuild

# Check cluster status
make k8s-status

# View logs for specific service
make k8s-logs SERVICE=api    # Options: api, ws, ui, postgres, redis, jaeger

# Restart deployments
make k8s-restart-api
make k8s-restart-ws
make k8s-restart-ui

# Port forward services
make k8s-portforward-db        # PostgreSQL -> localhost:5432
make k8s-portforward-jaeger    # Jaeger UI -> localhost:16686
```

### API Development (Go)

```bash
cd donfra-api

# Run locally (requires Go 1.24+, Python3)
make run              # or: go run ./cmd/donfra-api

# Build binary
make build            # outputs to ./bin/donfra-api

# Format code
make format           # go fmt ./...

# Clean build artifacts
make clean
```

### UI Development (Next.js)

```bash
cd donfra-ui

# Development server
npm run dev           # http://localhost:3000

# Production build
npm run build
npm run start

# Build only
make build
```

### WebSocket Server Development

```bash
cd donfra-ws

# Start locally (Node.js 16+)
npm start             # port 6789

# Docker operations
make up               # docker-compose up -d --build
make down
make logs
```

### Production Commands

```bash
# Start production stack with Caddy
make prod-up

# Stop production stack
make prod-down

# Restart production stack
make prod-restart

# View production logs
make prod-logs

# Restart specific production services
make prod-restart-api
make prod-restart-caddy

# Build and push UI to Docker Hub
make docker-build-ui UI_IMAGE_TAG=1.0.4
make docker-push-ui UI_IMAGE_TAG=1.0.4
```

### Database Operations

```bash
# Load all SQL files from infra/db/ into database
make load-db-sample

# Create database backup snapshot
make db-backup

# Restore from specific backup
make db-restore BACKUP_FILE=./db-backups/donfra_backup_YYYYMMDD_HHMMSS.sql

# Restore from latest backup
make db-restore-latest

# List available backups
make db-list-backups

# Add 20 test lessons (mixed published/unpublished and VIP)
make add-20-lessons
```

### Jaeger Tracing

```bash
# Open Jaeger UI info
make jaeger-ui

# View Jaeger logs (local)
make jaeger-logs

# View Jaeger logs (production)
make jaeger-logs-prod

# Generate Caddy Basic Auth password hash
make jaeger-hash-password
```

## Architecture & Key Patterns

### Room-Based Access Control
- The core concept is a single "room" that can be opened/closed with a passcode
- Opening a room generates a JWT token for creating invite links
- Users join via invite token and receive a `room_access` cookie
- All Python code execution requires an active room session

### Python Code Execution
- Code runs in sandboxed subprocess: `python3 -I -u -`
- Hard timeout of 5 seconds per execution
- Returns stdout/stderr to the collaborative editor
- Located in [donfra-api/internal/domain/run/](../donfra-api/internal/domain/run/)

### Real-Time Collaboration (CRDT)
- Uses Yjs library for conflict-free replicated data types
- WebSocket connection to `donfra-ws` server
- Monaco Editor bindings via `y-monaco`
- Peer awareness shows online users with assigned colors
- All collaboration state is ephemeral (in-memory only)

### Service Communication

**Production (Docker Compose + Caddy):**
- Caddy reverse proxy routes traffic to services
  - `/api/*` → Go API (port 8080)
  - `/yjs/*` and `/ws/*` → Node.js WebSocket server (port 6789)
  - Everything else → Next.js UI (port 3000)
- Docker network name: `donfra`

**Local dev (Docker Compose):**
- Services exposed directly on localhost ports
- No reverse proxy

**Kubernetes (Kind):**
- Istio Ambient mesh with Gateway API for traffic routing
- Services deployed in `donfra` namespace
- Gateway routes traffic similar to Caddy configuration
- Local access via `donfra.local` (requires `/etc/hosts` entry)
- Observability stack: Prometheus, Grafana, Loki, Jaeger, OpenTelemetry Collector

### Database & Lessons
- PostgreSQL 16 with GORM ORM
- Single `lessons` table with columns: `id`, `slug`, `title`, `markdown`, `excalidraw` (JSONB), `is_published`, timestamps
- Seeded via [infra/db/seed_lessons.sql](../infra/db/seed_lessons.sql)
- CRUD operations in [donfra-api/internal/domain/study/](../donfra-api/internal/domain/study/)

### Redis Integration
- Used for caching and session management
- Deployed in both Docker Compose and Kubernetes environments
- Configured via environment variables in API service

### Observability
- **Jaeger**: Distributed tracing for request flows
- **Prometheus**: Metrics collection from all services
- **Grafana**: Dashboards for metrics and logs visualization
- **Loki**: Log aggregation
- **OpenTelemetry Collector**: Unified telemetry collection and export

## Project Structure

```
donfra/
├── claude_md/                        # Claude Code documentation
│   └── CLAUDE.md                     # This file
├── donfra-api/
│   ├── cmd/donfra-api/main.go       # Entry point
│   └── internal/
│       ├── config/                   # Env var configuration
│       ├── domain/
│       │   ├── auth/                 # JWT generation/validation
│       │   ├── room/                 # Room state (in-memory)
│       │   ├── run/                  # Python subprocess execution
│       │   ├── study/                # Lesson CRUD
│       │   └── db/                   # Database initialization
│       ├── http/
│       │   ├── router/               # Chi router setup
│       │   ├── handlers/             # API endpoint handlers
│       │   └── middleware/           # CORS, request ID, auth
│       └── pkg/                      # Shared utilities
├── donfra-ws/
│   └── demo-server.js                # Yjs WebSocket server + API proxy
├── donfra-ui/
│   ├── app/                          # Next.js App Router pages
│   │   ├── coding/                   # Collaborative code editor
│   │   ├── library/                  # Lesson library & detail pages
│   │   └── admin-dashboard/          # Admin panel
│   ├── components/CodePad.tsx        # Main collaborative editor component
│   ├── lib/api.ts                    # API client utilities
│   └── public/styles/main.css        # ALL styling (CSS only, no CSS-in-JS)
└── infra/
    ├── docker-compose.yml            # Production setup with Caddy
    ├── docker-compose.local.yml      # Local dev setup
    ├── caddy/Caddyfile               # Reverse proxy routing
    ├── db/seed_lessons.sql           # Database initialization
    └── k8s/                          # Kubernetes manifests
        ├── base/                     # Base K8s resources
        ├── kind-config.yaml          # Kind cluster configuration
        ├── setup-kind.sh             # Cluster setup script
        ├── teardown-kind.sh          # Cluster teardown script
        ├── rebuild-images.sh         # Image rebuild script
        ├── logs.sh                   # Log viewing script
        └── verify-setup.sh           # Setup verification script
```

## Critical Configuration

### API Environment Variables (`donfra-api`)
- `ADDR`: Listen address (default: `:8080`)
- `PASSCODE`: Room opening passcode (default: `7777`)
- `ADMIN_PASS`: Admin authentication (default: `7777`)
- `JWT_SECRET`: JWT signing secret (default: `don-secret`)
- `DATABASE_URL`: PostgreSQL connection string
- `CORS_ORIGIN`: Allowed frontend origin (default: `http://localhost:3000`)
- `BASE_URL`: Frontend URL for generating invite links
- `REDIS_ADDR`: Redis server address (optional)

### UI Environment Variables (`donfra-ui`)
- `NEXT_PUBLIC_API_BASE_URL`: API endpoint (default: `/api`)
- `NEXT_PUBLIC_COLLAB_WS`: WebSocket endpoint (default: `/yjs`)
- `API_PROXY_TARGET`: Internal API proxy (default: `http://api:8080`)
- `WS_PROXY_TARGET`: Internal WS proxy (default: `http://ws:6789`)

### WS Environment Variables (`donfra-ws`)
- `PORT`: Listen port (default: `6789`)
- `PRODUCTION`: Enable production mode (caching, gzip)
- `WS_PATH`: WebSocket path (default: `/ws`)
- `ROOM_UPDATE_URL`: API endpoint for posting active user counts
- `API_TARGET`: API forward target for `/api/*` proxy

## API Endpoints

All paths accessible via `/api` or `/api/v1`:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/room/init` | Open room (requires passcode), returns invite link |
| GET | `/room/status` | Check if room is open |
| POST | `/room/join` | Join room (requires token), sets `room_access` cookie |
| POST | `/room/close` | Close room |
| POST | `/run` | Execute Python code (requires active room) |
| GET/POST | `/lessons` | Lesson CRUD operations |
| GET | `/lessons/:slug` | Get specific lesson by slug |

## Development Workflow

1. **Local development (Docker Compose)**: Use `make localdev-up` to start all services
2. **Local development (Kubernetes)**: Use `make k8s-setup` to start Kind cluster
3. **API changes**: Room state is in-memory and resets on restart
4. **UI changes**: Next.js hot-reloads automatically in dev mode
5. **Database changes**: Modify `infra/db/seed_lessons.sql` and run `make localdev-restart-db` (Docker) or `make k8s-rebuild` (K8s)
6. **Styling**: All CSS in `/donfra-ui/public/styles/main.css` (no CSS-in-JS)
7. **TypeScript**: Strict mode enabled with path aliasing (`@/*` → `./`)
8. **K8s image updates**: After changing code, run `make k8s-rebuild` to rebuild images and reload into cluster

## Key Technologies

- **Backend**: Go 1.24, Chi router v5.1.0, GORM ORM, JWT authentication
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript 5.5.4 (strict mode)
- **Real-time**: Yjs 13.6.27, y-websocket, y-monaco, WebSocket (ws library)
- **UI Components**: Monaco Editor 0.55.1, Excalidraw 0.18.0, Framer Motion 11.2.10
- **Infrastructure**: Docker, Docker Compose, Kubernetes (Kind), Caddy 2, PostgreSQL 16, Redis
- **Service Mesh**: Istio Ambient mode with Gateway API
- **Observability**: Jaeger, Prometheus, Grafana, Loki, OpenTelemetry Collector
- **Styling**: Plain CSS only (no Tailwind, no CSS-in-JS)

## Important Notes

- Room state is **ephemeral** (in-memory) and resets when API restarts
- Python execution is **sandboxed** with 5-second timeout
- Collaborative editing state is **ephemeral** (not persisted to database)
- Only lesson content (`markdown`, `excalidraw`) is persisted to PostgreSQL
- All CSS must be in `/donfra-ui/public/styles/main.css`
- TypeScript path aliases: `@/` resolves to `./` in donfra-ui
- CORS headers now expose `X-Request-Id` for request tracing
- Kubernetes setup uses Istio Ambient mesh for traffic management and observability

## Kubernetes Notes

- Kind cluster config: [infra/k8s/kind-config.yaml](../infra/k8s/kind-config.yaml)
- All K8s manifests in [infra/k8s/base/](../infra/k8s/base/)
- Services run in `donfra` namespace
- Gateway API used for ingress routing (Istio Ambient)
- Local access via `donfra.local` (add to `/etc/hosts`: `127.0.0.1 donfra.local`)
- Observability dashboards accessible via port-forwarding or ingress
- Persistent volumes for PostgreSQL and Redis data
