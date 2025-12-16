# Redis Pub/Sub Migration

**Date:** 2024-12-16
**Status:** ✅ Completed

## Overview

Migrated the headcount update mechanism from HTTP POST to Redis Pub/Sub pattern for better decoupling and scalability.

## Motivation

### Previous Architecture (HTTP POST)
```
┌─────────┐  HTTP POST /api/room/update-people  ┌─────────┐
│ WS      │ ──────────────────────────────────> │ API     │
│ Server  │         {headcount: N}               │ Server  │
└─────────┘                                      └─────────┘
```

**Issues:**
- ❌ Tight coupling between WS and API
- ❌ WS server needs to know API endpoint URL
- ❌ Unidirectional communication
- ❌ Difficult to scale with multiple API instances

### New Architecture (Redis Pub/Sub)
```
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ WS      │  PUBLISH         │ Redis   │  SUBSCRIBE       │ API     │
│ Server  │ ──────────────>  │ Pub/Sub │ <──────────────  │ Server  │
└─────────┘  room:headcount  └─────────┘                  └─────────┘
             count.toString()
```

**Benefits:**
- ✅ Complete decoupling - services only depend on Redis
- ✅ Supports multiple API instances (all receive updates)
- ✅ More scalable and maintainable
- ✅ Follows pub/sub messaging pattern

## Changes Made

### 1. WebSocket Server (`donfra-ws`)

**File: `ws-server.js`**
- Added Redis client connection
- Replaced HTTP POST logic with `redis.publish()`
- Publishes to channel: `room:headcount`
- Message format: plain number string (e.g., `"5"`)

**File: `package.json`**
- Added dependency: `redis@^4.7.0`

**Environment Variables:**
- Removed: `ROOM_UPDATE_URL`
- Added: `REDIS_ADDR` (default: `localhost:6379`)

### 2. API Server (`donfra-api`)

**New File: `internal/domain/room/pubsub.go`**
```go
type HeadcountSubscriber struct {
    client *redis.Client
    repo   Repository
}

func (s *HeadcountSubscriber) Start(ctx context.Context) error {
    pubsub := s.client.Subscribe(ctx, "room:headcount")
    // Listen for messages and update room state
}
```

**File: `cmd/donfra-api/main.go`**
- Start Pub/Sub subscriber on startup (goroutine)
- Graceful shutdown on SIGTERM/SIGINT
- Close Redis connection properly

**Removed:**
- HTTP endpoint: `POST /api/room/update-people`
- Handler: `RoomUpdatePeople()` in `handlers/room.go`
- Route registration in `router/router.go`

### 3. Docker Compose Configuration

**Files Modified:**
- `infra/docker-compose.yml`
- `infra/docker-compose.local.yml`

**WS Service Changes:**
```yaml
environment:
  # Before:
  - ROOM_UPDATE_URL=http://api:8080/api/room/update-people

  # After:
  - REDIS_ADDR=redis:6379

depends_on:
  - redis  # Added dependency
```

## Redis Channel Specification

### Channel: `room:headcount`

**Publisher:** WebSocket Server (`donfra-ws`)

**Subscribers:** All API Server instances (`donfra-api`)

**Message Format:** Plain number string
- Example: `"0"`, `"5"`, `"12"`
- Encoding: UTF-8
- No JSON wrapper

**Publish Frequency:**
- Checked every 3 seconds
- Only published when count changes

## Testing

### Local Testing (Docker Compose)

```bash
# 1. Install dependencies
cd donfra-ws
npm install

# 2. Start services
make localdev-up

# 3. Check logs
docker logs donfra-ws -f     # Should see: "Published headcount X to Redis channel"
docker logs donfra-api -f    # Should see: "[pubsub] Updated headcount to X"

# 4. Test by connecting WebSocket clients
# Open multiple browser tabs to http://localhost/coding
# Watch headcount updates in real-time
```

### Kubernetes Testing

```bash
# 1. Rebuild images with new code
make k8s-rebuild

# 2. Check pod logs
kubectl logs -n donfra -l app=ws -f
kubectl logs -n donfra -l app=api -f

# 3. Verify Redis Pub/Sub
kubectl exec -n donfra redis-0 -- redis-cli PUBSUB CHANNELS
# Should show: room:headcount

kubectl exec -n donfra redis-0 -- redis-cli PUBSUB NUMSUB room:headcount
# Should show: room:headcount <number_of_subscribers>
```

## Monitoring

### Key Log Messages

**WS Server:**
```
2024-12-16T10:30:00.000Z Redis publisher connected to redis:6379
2024-12-16T10:30:03.000Z Stats: {"conns":2,"docs":1,"websocket":"ws://localhost:6789","http":"http://localhost:6789"}
2024-12-16T10:30:03.000Z Published headcount 2 to Redis channel 'room:headcount'
```

**API Server:**
```
[donfra-api] using Redis repository at redis:6379
[pubsub] Subscribed to room:headcount channel
[pubsub] Updated headcount to 2
```

### Health Check

**WS Server:**
```bash
curl http://localhost:6789/health
# Response: {"response":"ok","redis":true}
```

## Rollback Plan

If issues occur, revert these commits and:

1. Restore `ROOM_UPDATE_URL` in docker-compose files
2. Restore `POST /api/room/update-people` endpoint
3. Revert `ws-server.js` to use HTTP POST
4. Remove `pubsub.go` and related code in `main.go`

## Future Enhancements

1. **Add retry logic** for Redis connection failures
2. **Metrics**: Track pub/sub message counts, latency
3. **Use structured messages**: Consider JSON format for extensibility
4. **Multiple channels**: Separate channels for different room events
5. **Persistence**: Consider Redis Streams for message history

## Related Files

- [donfra-ws/ws-server.js](../donfra-ws/ws-server.js)
- [donfra-ws/package.json](../donfra-ws/package.json)
- [donfra-api/internal/domain/room/pubsub.go](../donfra-api/internal/domain/room/pubsub.go)
- [donfra-api/cmd/donfra-api/main.go](../donfra-api/cmd/donfra-api/main.go)
- [infra/docker-compose.yml](../infra/docker-compose.yml)
- [infra/docker-compose.local.yml](../infra/docker-compose.local.yml)

## References

- [Redis Pub/Sub Documentation](https://redis.io/docs/manual/pubsub/)
- [go-redis Pub/Sub Guide](https://redis.uptrace.dev/guide/go-redis-pubsub.html)
- [Node Redis v4 Pub/Sub](https://github.com/redis/node-redis#pubsub)
