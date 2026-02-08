# Donfra

![Go Version](https://img.shields.io/badge/go-1.24-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

> Educational/career mentorship platform with real-time collaborative coding, live streaming, and AI code analysis.

## Architecture

```
donfra/
├── donfra-api/          # Go REST API (auth, lessons, interview, LiveKit, AI)
│   ├── cmd/donfra-api/  # Entry point
│   └── internal/
│       ├── domain/      # Business logic
│       │   ├── aiagent/    # DeepSeek AI code analysis
│       │   ├── google/     # Google OAuth 2.0
│       │   ├── interview/  # Interview room management
│       │   ├── livekit/    # Live streaming sessions
│       │   ├── study/      # Lesson CRUD + review workflow
│       │   ├── user/       # User auth & roles
│       │   └── db/         # Database init
│       ├── http/        # Handlers, middleware, router
│       └── pkg/         # httputil, metrics, tracing
├── donfra-ws/           # Node.js WebSocket (Yjs CRDT collaboration)
├── donfra-ui/           # Next.js frontend (Monaco, Excalidraw)
└── infra/
    ├── docker-compose.yml        # Production (Caddy + all services)
    ├── docker-compose.local.yml  # Local dev
    ├── db/                       # SQL migrations (000-003)
    └── k8s-lke/                  # Kubernetes manifests (LKE)
```

## Quick Start

```bash
# Local development (Docker Compose)
make localdev-up

# API tests
cd donfra-api && make test

# Stop
make localdev-down
```

## Deployment

### Docker Compose (Production)

```bash
make prod-up                  # Start with Caddy reverse proxy
make prod-down                # Stop
make prod-restart-api         # Restart API only

# Build & push images
make docker-build-api API_IMAGE_TAG=1.0.11
make docker-push-api API_IMAGE_TAG=1.0.11
make docker-build-ui UI_IMAGE_TAG=1.0.28
make docker-push-ui UI_IMAGE_TAG=1.0.28
```

Caddy routes: `/api/*` -> API, `/yjs/*` `/ws/*` -> WS, `/*` -> UI

### Kubernetes (LKE)

Production runs on **Linode Kubernetes Engine**, namespace `donfra-eng`.

**Components:**
- Envoy Gateway + cert-manager (Let's Encrypt TLS via Cloudflare DNS-01)
- Gateway API HTTPRoutes on `donfra.dev`
- Sealed Secrets for credentials
- PostgreSQL StatefulSet (10Gi PVC)
- Redis, LiveKit (hostNetwork for WebRTC UDP)
- CI/CD RBAC with dedicated deployer ServiceAccount

**Manifests:** `infra/k8s-lke/` applied via kustomization.yaml in numbered order (00-99).

### Grafana Cloud Observability

**Grafana Alloy** DaemonSet (monitoring namespace) collects and forwards:

| Signal | Source | Destination |
|--------|--------|-------------|
| Logs | All pod logs | Grafana Cloud Loki |
| Metrics | kubelet, cAdvisor, donfra pods | Grafana Cloud Prometheus |
| Traces | API (OpenTelemetry OTLP) | Grafana Cloud Tempo |

API traces are sent to `alloy.monitoring.svc.cluster.local:4318` (OTLP HTTP).

Dashboards: `grafana.donfra.dev` | Prometheus: `prometheus.donfra.dev`

## API Endpoints

Base: `/api` or `/api/v1`

| Group | Method | Path | Auth |
|-------|--------|------|------|
| **Auth** | POST | `/auth/register` | Public |
| | POST | `/auth/login` | Public |
| | POST | `/auth/logout` | Public |
| | GET | `/auth/google/url` | Public |
| | GET | `/auth/google/callback` | Public |
| | GET | `/auth/me` | Optional |
| | POST | `/auth/refresh` | Required |
| | POST | `/auth/update-password` | Required |
| **Admin** | GET | `/admin/users` | God |
| | PATCH | `/admin/users/{id}/role` | God |
| | PATCH | `/admin/users/{id}/active` | God |
| **Lessons** | GET | `/lessons/summary` | Optional |
| | GET | `/lessons` | Optional |
| | GET | `/lessons/{slug}` | Optional |
| | POST | `/lessons` | Admin+ |
| | PATCH | `/lessons/{slug}` | Admin+ |
| | DELETE | `/lessons/{slug}` | Admin+ |
| | GET | `/lessons/pending-review` | Admin+ |
| | POST | `/lessons/{slug}/submit-review` | Admin+ |
| | POST | `/lessons/{slug}/review` | Admin+ |
| **Interview** | POST | `/interview/init` | Admin+ |
| | POST | `/interview/join` | Public |
| | POST | `/interview/close` | Admin+ |
| | GET | `/interview/my-rooms` | Required |
| | GET | `/interview/rooms/{room_id}/status` | Public |
| | GET | `/interview/rooms/all` | Admin+ |
| **Live** | POST | `/live/create` | Admin+ |
| | POST | `/live/join` | Optional |
| | POST | `/live/end` | Admin+ |
| **AI** | POST | `/ai/analyze` | VIP+ |
| | POST | `/ai/chat` | VIP+ |
| | POST | `/ai/chat/stream` | VIP+ |
| **System** | GET | `/healthz` | None |
| | GET | `/metrics` | None |

User roles: `user` < `vip` < `admin` < `god`

## Database

PostgreSQL 16, migrations in `infra/db/`:

| File | Purpose |
|------|---------|
| `000_seed_lessons.sql` | Lessons table + seed data |
| `001_create_users_table.sql` | Users table (roles, OAuth, soft delete) |
| `002_create_interview_rooms.sql` | Interview rooms table |
| `003_add_lesson_review.sql` | Review workflow (draft -> pending -> approved/rejected) |

```bash
make load-db-sample       # Load all migrations
make db-migrate-review    # Run review migration only
make db-reset             # Drop + recreate + seed
make db-backup            # Timestamped backup
make db-restore-latest    # Restore latest
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Go 1.24, Chi v5, GORM, JWT, Google OAuth, DeepSeek AI |
| Frontend | Next.js 14, React 18, TypeScript, Monaco Editor, Excalidraw |
| Real-time | Yjs CRDT, y-websocket, LiveKit (video/audio) |
| Infra | Docker Compose, LKE (K8s), Caddy 2, Envoy Gateway |
| Data | PostgreSQL 16, Redis 7 |
| Observability | OpenTelemetry, Jaeger (local), Grafana Cloud (prod) |

## License

MIT
