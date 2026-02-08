# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Donfra** is a full-stack educational/career mentorship platform with real-time collaborative coding, live streaming, and AI-powered code analysis. Monorepo with three services:

- **donfra-api** (Go): REST API - user auth, lessons, interview rooms, LiveKit streaming, AI agent
- **donfra-ws** (Node.js): WebSocket server for real-time collaborative editing (Yjs CRDT)
- **donfra-ui** (Next.js): SSR frontend with Monaco editor, Excalidraw whiteboarding

## Common Commands

### Full Stack (Docker Compose)

```bash
make localdev-up              # Start all services
make localdev-down             # Stop all services
make localdev-restart-api      # Restart API
make localdev-restart-ws       # Restart WS
make localdev-restart-ui       # Restart UI
make localdev-restart-db       # Restart DB
make localdev-restart-redis    # Restart Redis
make logs                      # View logs (tail -200)
make ps                        # List containers
```

### Production

```bash
make prod-up / prod-down / prod-restart
make prod-restart-api / prod-restart-caddy
make prod-logs / prod-ps

# Docker Hub
make docker-build-api API_IMAGE_TAG=1.0.11
make docker-push-api API_IMAGE_TAG=1.0.11
make docker-build-ui UI_IMAGE_TAG=1.0.28
make docker-push-ui UI_IMAGE_TAG=1.0.28
```

### API Development (Go)

```bash
cd donfra-api
make run               # go run ./cmd/donfra-api
make build             # outputs to ./bin/donfra-api
make test              # Run tests
make test-coverage     # Coverage report
make lint              # golangci-lint
make format            # go fmt ./...
```

### Database

```bash
make load-db-sample          # Load all SQL from infra/db/
make db-migrate-review       # Run review migration (003)
make db-reset                # Drop + recreate + seed
make db-backup               # Timestamped backup
make db-restore-latest       # Restore latest backup
make db-list-backups         # List backups
make add-20-lessons          # Add 20 test lessons
```

## API Architecture

### Project Structure

```
donfra-api/
├── cmd/donfra-api/main.go
└── internal/
    ├── config/config.go              # All env vars
    ├── domain/
    │   ├── aiagent/                  # DeepSeek AI code analysis + chat
    │   ├── google/                   # Google OAuth 2.0
    │   ├── interview/                # Interview room management
    │   ├── livekit/                  # LiveKit live streaming sessions
    │   ├── study/                    # Lesson CRUD + review workflow
    │   ├── user/                     # User auth, roles, password
    │   └── db/                       # Database initialization
    ├── http/
    │   ├── handlers/                 # HTTP endpoint handlers
    │   ├── middleware/               # Auth, metrics, tracing, CORS, request ID
    │   └── router/router.go         # Chi router setup
    └── pkg/
        ├── httputil/                 # JSON response helpers
        ├── metrics/                  # Prometheus metrics definitions
        └── tracing/                  # OpenTelemetry/Jaeger setup
```

### Domain Models

**Users** (`users` table):
- Fields: id, email (unique), password (bcrypt), username, role, is_active, google_id, google_avatar
- Roles: `user` (default), `vip`, `admin`, `god`
- `UserPublic` excludes password, adds `can_stealth` (admin/god)
- Soft delete support

**Lessons** (`lessons` table):
- Fields: id, slug (unique), title, markdown, excalidraw (JSONB), video_url, code_template (JSONB), is_published, is_vip, author, published_date
- Review fields: review_status, submitted_by, reviewed_by, submitted_at, reviewed_at
- Review workflow: `draft` → `pending_review` → `approved`/`rejected` → publish
- VIP lessons: non-VIP users see only title/metadata (empty markdown/excalidraw)
- Pagination with sort (created_at, updated_at, title, id, published_date) and search (title, slug, author)

**Interview Rooms** (`interview_rooms` table):
- Fields: id, room_id (UUID), owner_id (FK), headcount, code_snapshot, invite_link
- JWT-based invite tokens with configurable expiry
- Soft delete support

**Live Sessions** (`live_sessions` table - LiveKit):
- Fields: session_id, owner_id, title, description, session_type, status, max_participants
- Types: teaching, interview, coding, workshop
- Status: scheduled, live, ended, cancelled
- Admin stealth mode (join hidden)

### API Endpoints

Base paths: `/api` and `/api/v1`

**Auth (public):**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login (sets auth_token cookie) |
| POST | `/auth/logout` | Clear auth cookie |
| GET | `/auth/google/url` | Google OAuth URL + state |
| GET | `/auth/google/callback` | OAuth callback (redirect) |
| GET | `/auth/me` | Current user (OptionalAuth) |
| POST | `/auth/refresh` | Refresh JWT (RequireAuth) |
| POST | `/auth/update-password` | Update password (RequireAuth) |

**Admin (God only):**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/users` | List all users |
| PATCH | `/admin/users/{id}/role` | Update user role |
| PATCH | `/admin/users/{id}/active` | Toggle active status |

**Lessons:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/lessons/summary` | Lesson summaries (OptionalAuth) |
| GET | `/lessons` | List lessons (OptionalAuth) |
| GET | `/lessons/{slug}` | Lesson detail (OptionalAuth) |
| POST | `/lessons` | Create (Admin+) |
| PATCH | `/lessons/{slug}` | Update (Admin+) |
| DELETE | `/lessons/{slug}` | Delete (Admin+) |
| GET | `/lessons/pending-review` | Pending reviews (Admin+) |
| POST | `/lessons/{slug}/submit-review` | Submit for review (Admin+) |
| POST | `/lessons/{slug}/review` | Approve/reject (Admin+) |

**Interview Rooms:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/interview/init` | Create room (Admin+) |
| POST | `/interview/join` | Join room (public) |
| POST | `/interview/close` | Close room (Admin+) |
| GET | `/interview/my-rooms` | User's rooms (RequireAuth) |
| GET | `/interview/rooms/{room_id}/status` | Room status (public) |
| GET | `/interview/rooms/all` | All rooms (Admin+) |

**LiveKit Streaming:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/live/create` | Create session (Admin+) |
| POST | `/live/join` | Join session (OptionalAuth) |
| POST | `/live/end` | End session (Admin+) |

**AI Agent (VIP+):**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/ai/analyze` | Analyze code |
| POST | `/ai/chat` | Chat with history |
| POST | `/ai/chat/stream` | SSE streaming chat |

**System:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | Health check |
| GET | `/metrics` | Prometheus metrics |

### Middleware Stack

Applied globally (in order):
1. `Tracing("donfra-api")` - OpenTelemetry spans
2. `Metrics` - HTTP request metrics
3. `CORS` - with `X-Request-Id` exposed
4. `RequestID` - unique request ID

Per-route auth middleware:
- `RequireAuth(userSvc)` - JWT from cookie, rejects without auth
- `OptionalAuth(userSvc)` - validates JWT if present
- `RequireAdminOrAbove()` - admin/god
- `RequireVIPOrAbove()` - vip/admin/god
- `RequireGodUser()` - god only

Context values: `user_id` (uint), `user_email` (string), `user_role` (string)

### Observability

**Prometheus Metrics:**
- HTTP: `donfra_http_requests_total`, `donfra_http_request_duration_seconds`, `donfra_http_requests_in_flight`
- Business: `donfra_lessons_total`, `donfra_lessons_published`, `donfra_users_total`, `donfra_interview_rooms_active`
- Auth: `donfra_auth_login_total`, `donfra_auth_register_total`
- DB: `donfra_db_query_duration_seconds`
- AI: `donfra_ai_requests_total`

**Tracing:** OpenTelemetry → OTLP HTTP → Jaeger (local) or Grafana Cloud Tempo (K8s)

### Environment Variables (`donfra-api`)

| Variable | Default | Description |
|----------|---------|-------------|
| `ADDR` | `:8080` | Listen address |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `JWT_SECRET` | `donfra-secret` | JWT signing secret |
| `JWT_EXPIRY_HOURS` | `168` (7d) | JWT token lifetime |
| `COOKIE_MAX_AGE_DAYS` | `7` | Auth cookie lifetime |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `BASE_URL` | - | Frontend URL for invite links |
| `FRONTEND_URL` | `http://localhost` | OAuth redirect target |
| `REDIS_ADDR` | `redis:6379` | Redis address |
| `USE_REDIS` | `false` | Enable Redis |
| `JAEGER_ENDPOINT` | - | OTLP HTTP endpoint (e.g. `jaeger:4318`) |
| `GOOGLE_CLIENT_ID` | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | - | Google OAuth secret |
| `GOOGLE_REDIRECT_URL` | `http://localhost:8080/api/auth/google/callback` | OAuth redirect |
| `OAUTH_STATE_EXPIRY_MINS` | `10` | OAuth state TTL |
| `DEEPSEEK_API_KEY` | - | DeepSeek API key |
| `LIVEKIT_API_KEY` | dev key | LiveKit API key |
| `LIVEKIT_API_SECRET` | dev secret | LiveKit API secret |
| `LIVEKIT_SERVER_URL` | `ws://livekit:7880` | LiveKit internal URL |
| `LIVEKIT_PUBLIC_URL` | `/livekit` | LiveKit public URL |
| `INVITE_TOKEN_EXPIRY_HOURS` | `24` | Interview invite token expiry |
| `LIVEKIT_TOKEN_EXPIRY_HOURS` | `24` | LiveKit token expiry |

## Database

- PostgreSQL 16 with GORM
- Container: `donfra-db`, user: `donfra`, database: `donfra_study`
- Migrations in `infra/db/` numbered sequentially:
  - `000_seed_lessons.sql` - lessons table + seed data
  - `001_create_users_table.sql` - users table with roles, OAuth
  - `002_create_interview_rooms.sql` - interview rooms table
  - `003_add_lesson_review.sql` - review workflow columns

## Infrastructure

### Service Communication

**Production (Docker Compose + Caddy):**
- Caddy routes: `/api/*` → API:8080, `/yjs/*` `/ws/*` → WS:6789, `/*` → UI:3000
- Docker network: `donfra`

**Local dev (Docker Compose):**
- Services exposed directly on localhost ports, no reverse proxy

**Kubernetes (LKE):**
- Linode Kubernetes Engine, namespace `donfra-eng`
- Envoy Gateway + cert-manager for TLS (Let's Encrypt + Cloudflare DNS-01)
- Gateway API HTTPRoutes for path-based routing on `donfra.dev`
- Sealed secrets for sensitive config
- Grafana Alloy DaemonSet → Grafana Cloud (Loki, Prometheus, Tempo)

### Grafana Cloud Observability (K8s)

Grafana Alloy agent collects and forwards:
- **Logs** → Grafana Cloud Loki (all pod logs)
- **Metrics** → Grafana Cloud Prometheus (kubelet, cAdvisor, donfra-eng pods)
- **Traces** → Grafana Cloud Tempo (OTLP from API via `alloy.monitoring.svc.cluster.local:4318`)

### Key Technologies

- **Backend**: Go 1.24, Chi v5.1.0, GORM, JWT, Google OAuth, DeepSeek AI
- **Frontend**: Next.js 14, React 18, TypeScript 5.5.4, Monaco Editor, Excalidraw
- **Real-time**: Yjs CRDT, y-websocket, y-monaco, LiveKit (video/audio)
- **Infrastructure**: Docker Compose, LKE (K8s), Caddy 2, Envoy Gateway, cert-manager
- **Data**: PostgreSQL 16, Redis 7
- **Observability**: OpenTelemetry, Jaeger (local), Grafana Cloud (prod)
- **Styling**: Plain CSS only (no Tailwind, no CSS-in-JS)

## Important Notes

- Room state and collaboration state are **ephemeral** (in-memory, reset on restart)
- Only lesson/user/interview data persisted to PostgreSQL
- Python execution is **sandboxed** with 5-second timeout
- All CSS in `/donfra-ui/public/styles/main.css`
- TypeScript path aliases: `@/` → `./` in donfra-ui
- Review workflow: mutual review enforced (can't review own), god bypasses review
- When adding methods to service interfaces, update corresponding mock structs in `*_test.go`
