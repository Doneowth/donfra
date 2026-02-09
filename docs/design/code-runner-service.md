# Design Doc: donfra-runner — Isolated Code Execution Service

**Author:** Don
**Date:** 2026-02-08
**Status:** Draft

---

## 1. Problem

The WebSocket server (`donfra-ws`) currently executes user-submitted code directly in its own process via `child_process.spawn()`. This has several critical issues:

1. **No isolation** — user code runs in the same container as the Yjs collaboration server, sharing the same filesystem, network, and process namespace
2. **No timeout** — `spawn()` ignores the `timeout` option; a `while True: pass` runs forever
3. **No resource limits** — no memory/CPU caps on child processes; a memory bomb (`'x' * 10**10`) can OOM the ws pod
4. **No authentication** — any WebSocket client can send `{ type: "execute" }` without identity verification
5. **Blast radius** — if code execution causes a crash or resource exhaustion, it takes down the entire collaboration server for all users

### Current Flow

```
Browser (CodePad.tsx)
  │
  │  WebSocket message: { type: "execute", source_code: "...", language_id: 71 }
  ▼
donfra-ws (ws-server.js)
  │
  │  spawn("python3", ["-c", source_code])   ← runs in same container
  ▼
Child process (no timeout, no resource limits, no sandbox)
  │
  │  stdout/stderr
  ▼
donfra-ws sends back: { type: "execution-result", stdout: "...", stderr: "..." }
```

---

## 2. Goal

Extract code execution into a dedicated, isolated microservice (`donfra-runner`) that:

- Runs in its own pod with strict resource limits
- Sandboxes each execution (process-level isolation with `nsjail`)
- Enforces timeouts, memory limits, and output caps
- Is network-isolated (no egress to other cluster services or internet)
- Exposes a simple HTTP API consumed by `donfra-ws`
- Supports multiple languages (Python, JavaScript, with Go planned)

### Non-Goals (for now)

- Per-user execution quotas (can be added later via API middleware)
- Persistent filesystem across executions (each run is ephemeral)
- Interactive/REPL mode (request-response only)
- Multi-file project execution

---

## 3. Architecture

### New Flow

```
Browser (CodePad.tsx)
  │
  │  WebSocket: { type: "execute", source_code, language_id }
  ▼
donfra-ws
  │
  │  HTTP POST http://runner:8090/execute
  │  Body: { source_code, language_id, stdin, timeout_ms }
  ▼
donfra-runner (dedicated pod)
  │
  │  nsjail sandbox:
  │    - read-only filesystem
  │    - no network
  │    - memory limit (64MB)
  │    - CPU time limit (5s)
  │    - PID limit (32)
  ▼
Sandboxed process (python3 / node / go run)
  │
  │  stdout/stderr (capped at 64KB)
  ▼
donfra-runner returns: { status, stdout, stderr, execution_time_ms }
  │
  ▼
donfra-ws sends back: { type: "execution-result", ... }
```

### Service Boundaries

| Service | Responsibility | Talks To |
|---------|---------------|----------|
| `donfra-ws` | Yjs CRDT sync, message routing | `donfra-runner` (HTTP) |
| `donfra-runner` | Sandboxed code execution | Nothing (network-isolated) |

`donfra-ws` no longer needs Python installed in its container. Its Dockerfile drops from `node:18-alpine` + Python to just `node:18-alpine`.

---

## 4. donfra-runner Service Design

### 4.1 Tech Stack

**Go** — consistent with `donfra-api`, small binary, good for process management and HTTP serving.

### 4.2 API

#### `POST /execute`

**Request:**
```json
{
  "source_code": "print('hello')",
  "language_id": 71,
  "stdin": "",
  "timeout_ms": 5000
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `source_code` | string | yes | — | Code to execute |
| `language_id` | int | yes | — | 71=Python, 63=JavaScript, 60=Go |
| `stdin` | string | no | `""` | Standard input |
| `timeout_ms` | int | no | `5000` | Max wall-clock time (cap: 10000) |

**Response (200):**
```json
{
  "status": {
    "id": 3,
    "description": "Accepted"
  },
  "stdout": "hello",
  "stderr": "",
  "execution_time_ms": 42,
  "token": "ws-exec"
}
```

**Status codes:**
| `status.id` | Meaning |
|-------------|---------|
| 3 | Accepted (exit code 0) |
| 5 | Time Limit Exceeded |
| 7 | Memory Limit Exceeded |
| 11 | Runtime Error (non-zero exit) |

**Error Response (4xx/5xx):**
```json
{
  "error": "source_code is required"
}
```

#### `GET /health`

Returns `200 OK` with supported languages and runner status.

```json
{
  "status": "ok",
  "languages": [71, 63, 60],
  "version": "1.0.0"
}
```

### 4.3 Sandbox Strategy — nsjail

[nsjail](https://github.com/google/nsjail) is Google's lightweight process isolation tool. It uses Linux namespaces, cgroups, and seccomp-bpf — no VM overhead, sub-millisecond setup time.

**Per-execution constraints:**

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Wall-clock time | 5s (configurable, max 10s) | Prevent infinite loops |
| CPU time | 5s | Prevent CPU abuse |
| Memory (RSS) | 64 MB | Prevent OOM |
| PID count | 32 | Prevent fork bombs |
| File size (write) | 1 MB | Prevent disk abuse |
| Network | Disabled | Prevent data exfiltration |
| Filesystem | Read-only (except /tmp) | Prevent host modification |
| Output capture | 64 KB max | Prevent memory exhaustion in runner |

**nsjail config template** (`/etc/nsjail/python.cfg`):

```protobuf
name: "python-sandbox"
mode: ONCE

time_limit: 5
rlimit_as: 64
rlimit_fsize: 1
max_cpus: 1

clone_newnet: true
clone_newuser: true
clone_newpid: true
clone_newns: true

mount {
  src: "/usr/bin/python3"
  dst: "/usr/bin/python3"
  is_bind: true
  rw: false
}

mount {
  src: "/usr/lib"
  dst: "/usr/lib"
  is_bind: true
  rw: false
}

mount {
  dst: "/tmp"
  fstype: "tmpfs"
  rw: true
  options: "size=1048576"
}

seccomp_string: "ALLOW {"
seccomp_string: "  read, write, open, close, stat, fstat, lstat,"
seccomp_string: "  mmap, mprotect, munmap, brk, ioctl, access,"
seccomp_string: "  execve, arch_prctl, set_tid_address, exit_group,"
seccomp_string: "  futex, set_robust_list, rt_sigaction, rt_sigprocmask,"
seccomp_string: "  getrlimit, openat, readlink, getrandom, prlimit64,"
seccomp_string: "  clone, wait4, dup, dup2, pipe, getpid, getuid, getgid"
seccomp_string: "}"
seccomp_string: "DEFAULT KILL"
```

### 4.4 Execution Flow (internal)

```go
func (s *Runner) Execute(ctx context.Context, req ExecuteRequest) ExecuteResult {
    // 1. Write source code to temp file
    tmpFile := writeTempFile(req.SourceCode, langExtension(req.LanguageID))
    defer os.Remove(tmpFile)

    // 2. Build nsjail command
    args := []string{
        "--config", configPath(req.LanguageID),
        "--", interpreter(req.LanguageID), tmpFile,
    }

    // 3. Execute with context timeout
    ctx, cancel := context.WithTimeout(ctx, time.Duration(req.TimeoutMs)*time.Millisecond)
    defer cancel()

    cmd := exec.CommandContext(ctx, "nsjail", args...)
    // ... capture stdout/stderr with size-limited buffers
    // ... pipe stdin if provided

    // 4. Determine exit status
    //    - ctx.Err() == DeadlineExceeded → TLE
    //    - exit code 137 (SIGKILL from cgroup OOM) → MLE
    //    - exit code != 0 → Runtime Error
    //    - exit code == 0 → Accepted
}
```

### 4.5 Project Structure

```
donfra-runner/
├── cmd/
│   └── donfra-runner/
│       └── main.go              # HTTP server, signal handling
├── internal/
│   ├── runner/
│   │   ├── runner.go            # Core execution logic
│   │   ├── runner_test.go
│   │   ├── languages.go         # Language configs (interpreter paths, extensions)
│   │   └── limiter.go           # Concurrent execution limiter
│   └── handler/
│       ├── handler.go           # HTTP handlers
│       └── handler_test.go
├── configs/
│   ├── python.cfg               # nsjail config for Python
│   ├── javascript.cfg           # nsjail config for Node.js
│   └── go.cfg                   # nsjail config for Go
├── Dockerfile
├── Makefile
├── go.mod
└── go.sum
```

---

## 5. Infrastructure

### 5.1 Dockerfile

```dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /donfra-runner ./cmd/donfra-runner

FROM alpine:3.20

# Install nsjail and language runtimes
RUN apk add --no-cache \
    nsjail \
    python3 \
    nodejs

# (Go execution via 'go run' needs Go toolchain — use a pre-built tiny Go image or compile-and-run approach)

COPY --from=builder /donfra-runner /usr/local/bin/donfra-runner
COPY configs/ /etc/nsjail/

RUN adduser -D -u 1000 runner
USER runner

EXPOSE 8090
CMD ["donfra-runner"]
```

### 5.2 Kubernetes Deployment (`14-runner.yaml`)

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: runner
  namespace: donfra-eng
  labels:
    app: runner
spec:
  replicas: 1
  selector:
    matchLabels:
      app: runner
  template:
    metadata:
      labels:
        app: runner
    spec:
      containers:
        - name: runner
          image: doneowth/donfra-runner:1.0.0
          ports:
            - containerPort: 8090
              name: http
          env:
            - name: ADDR
              value: ":8090"
            - name: MAX_CONCURRENT
              value: "4"
            - name: DEFAULT_TIMEOUT_MS
              value: "5000"
            - name: MAX_TIMEOUT_MS
              value: "10000"
            - name: MAX_OUTPUT_BYTES
              value: "65536"
          resources:
            requests:
              memory: "256Mi"
              cpu: "200m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          securityContext:
            # nsjail needs these capabilities
            capabilities:
              add:
                - SYS_ADMIN    # for clone(CLONE_NEWUSER, CLONE_NEWPID, etc.)
                - SYS_CHROOT   # for pivot_root
              drop:
                - ALL
            readOnlyRootFilesystem: false  # nsjail needs to write /tmp
          livenessProbe:
            httpGet:
              path: /health
              port: 8090
            initialDelaySeconds: 5
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health
              port: 8090
            initialDelaySeconds: 3
            periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: runner
  namespace: donfra-eng
  labels:
    app: runner
spec:
  type: ClusterIP
  ports:
    - port: 8090
      targetPort: 8090
      name: http
  selector:
    app: runner
```

### 5.3 NetworkPolicy (critical)

The runner pod must have **zero egress** — user code should never be able to reach the internet, the database, or other cluster services. The only allowed traffic is inbound from `donfra-ws`.

```yaml
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: runner-isolation
  namespace: donfra-eng
spec:
  podSelector:
    matchLabels:
      app: runner
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Only allow traffic from ws pods
    - from:
        - podSelector:
            matchLabels:
              app: ws
      ports:
        - port: 8090
          protocol: TCP
  egress: []  # No egress at all
```

---

## 6. Changes to Existing Services

### 6.1 donfra-ws

**Remove:** `executeCode()` function, `spawn` import, Python dependency.

**Add:** HTTP call to runner service.

```javascript
// Before (ws-server.js)
const { spawn } = require('child_process')
// ... 50 lines of spawn logic

// After
const RUNNER_URL = process.env.RUNNER_URL || 'http://runner:8090'

async function executeCode(req) {
  const resp = await fetch(`${RUNNER_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_code: req.source_code,
      language_id: req.language_id,
      stdin: req.stdin || '',
      timeout_ms: 5000
    }),
    signal: AbortSignal.timeout(12000) // 12s client timeout > 10s max server timeout
  })

  if (!resp.ok) {
    throw new Error(`Runner error: ${resp.status}`)
  }

  return resp.json()
}
```

**Dockerfile change:** Remove `RUN apk add --no-cache python3` — ws no longer executes code.

### 6.2 donfra-ui (CodePad.tsx)

No changes needed. The WebSocket message format stays the same:

```
Browser → ws: { type: "execute", source_code, language_id }
ws → Browser: { type: "execution-result", stdout, stderr, status }
```

The frontend doesn't know or care that execution now happens in a different pod.

### 6.3 K8s ConfigMap

Add `RUNNER_URL` to ws deployment environment:

```yaml
# 07-ws.yaml — add to env:
- name: RUNNER_URL
  value: "http://runner:8090"
```

---

## 7. Concurrency & Back-Pressure

The runner uses a **semaphore** to limit concurrent executions. If all slots are busy, requests get queued (with a timeout) or rejected with `429 Too Many Requests`.

```
MAX_CONCURRENT=4

Request 1 ──→ [slot 1] executing...
Request 2 ──→ [slot 2] executing...
Request 3 ──→ [slot 3] executing...
Request 4 ──→ [slot 4] executing...
Request 5 ──→ [queue] waiting... (up to 5s)
Request 6 ──→ [queue] waiting...
Request 7 ──→ 429 Too Many Requests (queue full)
```

This prevents a burst of execution requests from overwhelming the pod.

---

## 8. Observability

| Signal | Tool | Detail |
|--------|------|--------|
| Metrics | Prometheus | `runner_executions_total{language, status}`, `runner_execution_duration_seconds`, `runner_queue_depth` |
| Logs | stdout → Alloy → Loki | Structured JSON logs with execution_id, language, duration, exit_code |
| Health | `/health` endpoint | Used by K8s probes |

---

## 9. Rollout Plan

### Phase 1 — Build & Local Test
1. Create `donfra-runner` Go service with nsjail integration
2. Add nsjail configs for Python and JavaScript
3. Docker Compose entry for local development
4. Unit tests for runner logic, integration tests with real nsjail

### Phase 2 — Deploy & Migrate
5. Build and push `donfra-runner` Docker image
6. Deploy to K8s (`14-runner.yaml` + NetworkPolicy)
7. Update `donfra-ws` to call runner over HTTP
8. Rebuild and push `donfra-ws` image (without Python)
9. Deploy updated ws, verify execution still works end-to-end

### Phase 3 — Harden
10. Add Prometheus metrics to runner
11. Add concurrency limiter and 429 responses
12. Add Go language support
13. Load test: concurrent executions, fork bombs, memory bombs, infinite loops

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| nsjail not available in Alpine | Build blocker | Alpine has `nsjail` in community repo; fallback: build from source in multi-stage Docker |
| SYS_ADMIN capability is broad | Security surface | nsjail drops all caps inside the sandbox; pod-level caps are only for namespace creation |
| Runner pod OOM from concurrent executions | Service disruption | Semaphore limits concurrency; K8s memory limit as hard cap; cgroup per-execution memory limit as first defense |
| Latency increase (extra HTTP hop) | UX | Runner is same-cluster ClusterIP, expect <5ms network overhead; nsjail startup is <1ms |
| nsjail seccomp policy too restrictive | Some code won't run | Start permissive, tighten iteratively based on testing |

---

## 11. Alternative Approaches Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **K8s Job per execution** | Maximum isolation | 2-5s cold start, complex cleanup | Rejected — too slow for interactive codepad |
| **Firecracker microVM** | VM-level isolation | Complex setup, heavier resource usage | Overkill for this use case |
| **Docker-in-Docker** | Good isolation | Requires privileged container, security risk | Rejected |
| **gVisor (runsc)** | Syscall-level isolation | Requires custom RuntimeClass, node-level config on LKE | Possible future upgrade |
| **nsjail in dedicated pod** | Fast, lightweight, proven (used by Google CTF) | Needs SYS_ADMIN cap | **Selected** |
| **Fix spawn() timeout in ws** | Zero infrastructure change | Still no real isolation, no resource limits | Rejected — band-aid |
