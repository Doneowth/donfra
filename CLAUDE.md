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
# Start all services locally
make localdev-up

# Stop all services
make localdev-down

# Restart specific services
make localdev-restart-api
make localdev-restart-ws
make localdev-restart-ui
make localdev-restart-db

# View logs from all services
make logs

# Check running containers
make ps
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
- Located in `donfra-api/internal/domain/run/`

### Real-Time Collaboration (CRDT)
- Uses Yjs library for conflict-free replicated data types
- WebSocket connection to `donfra-ws` server
- Monaco Editor bindings via `y-monaco`
- Peer awareness shows online users with assigned colors
- All collaboration state is ephemeral (in-memory only)

### Service Communication
- **Production**: Caddy reverse proxy routes traffic to services
  - `/api/*` → Go API (port 8080)
  - `/yjs/*` and `/ws/*` → Node.js WebSocket server (port 6789)
  - Everything else → Next.js UI (port 3000)
- **Local dev**: Services exposed directly on localhost ports
- Docker network name: `donfra`

### Database & Lessons
- PostgreSQL 16 with GORM ORM
- Single `lessons` table with columns: `id`, `slug`, `title`, `markdown`, `excalidraw` (JSONB), `is_published`, timestamps
- Seeded via `infra/db/seed_lessons.sql`
- CRUD operations in `donfra-api/internal/domain/study/`

## Project Structure

```
donfra/
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
    └── db/seed_lessons.sql           # Database initialization
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

1. **Local development**: Use `make localdev-up` to start all services
2. **API changes**: Room state is in-memory and resets on restart
3. **UI changes**: Next.js hot-reloads automatically in dev mode
4. **Database changes**: Modify `infra/db/seed_lessons.sql` and run `make localdev-restart-db`
5. **Styling**: All CSS in `/donfra-ui/public/styles/main.css` (no CSS-in-JS)
6. **TypeScript**: Strict mode enabled with path aliasing (`@/*` → `./`)

## Key Technologies

- **Backend**: Go 1.24, Chi router v5.1.0, GORM ORM, JWT authentication
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript 5.5.4 (strict mode)
- **Real-time**: Yjs 13.6.27, y-websocket, y-monaco, WebSocket (ws library)
- **UI Components**: Monaco Editor 0.55.1, Excalidraw 0.18.0, Framer Motion 11.2.10
- **Infrastructure**: Docker, Docker Compose, Caddy 2, PostgreSQL 16
- **Styling**: Plain CSS only (no Tailwind, no CSS-in-JS)

## Important Notes

- Room state is **ephemeral** (in-memory) and resets when API restarts
- Python execution is **sandboxed** with 5-second timeout
- Collaborative editing state is **ephemeral** (not persisted to database)
- Only lesson content (`markdown`, `excalidraw`) is persisted to PostgreSQL
- All CSS must be in `/donfra-ui/public/styles/main.css`
- TypeScript path aliases: `@/` resolves to `./` in donfra-ui