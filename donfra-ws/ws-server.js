/**
 * Donfra WebSocket Server for Yjs Collaborative Editing
 * Handles real-time synchronization of code editor state across multiple clients
 */
const WebSocket = require('ws')
const http = require('http')
const ywsUtils = require('y-websocket/bin/utils')
const setupWSConnection = ywsUtils.setupWSConnection
const docs = ywsUtils.docs
const redis = require('redis')

const production = process.env.PRODUCTION != null
const port = process.env.PORT || 6789
const redisAddr = process.env.REDIS_ADDR || 'localhost:6379'
const runnerUrl = process.env.RUNNER_URL || 'http://runner:8090'

// Initialize Redis publisher client
let redisPublisher = null
let redisConnected = false

async function initRedis() {
  try {
    const [host, portStr] = redisAddr.split(':')
    redisPublisher = redis.createClient({
      socket: {
        host: host,
        port: parseInt(portStr || '6379', 10)
      }
    })

    redisPublisher.on('error', (err) => {
      console.error(`${new Date().toISOString()} Redis error:`, err)
      redisConnected = false
    })

    redisPublisher.on('connect', () => {
      console.log(`${new Date().toISOString()} Redis publisher connected to ${redisAddr}`)
      redisConnected = true
    })

    await redisPublisher.connect()
  } catch (err) {
    console.error(`${new Date().toISOString()} Failed to initialize Redis:`, err)
    redisPublisher = null
    redisConnected = false
  }
}

// Initialize Redis on startup
initRedis().catch(err => {
  console.error(`${new Date().toISOString()} Redis initialization failed:`, err)
})

/**
 * Execute code via donfra-runner service
 */
async function executeCode(req) {
  const { source_code, language_id, stdin = '' } = req

  if (!source_code || !language_id) {
    throw new Error('source_code and language_id are required')
  }

  const resp = await fetch(`${runnerUrl}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_code, language_id, stdin, timeout_ms: 5000 }),
    signal: AbortSignal.timeout(12000)
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Runner error ${resp.status}: ${body}`)
  }

  return resp.json()
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({
      status: 'ok',
      redis: redisConnected,
      runner: runnerUrl,
      rooms: docs.size,
      connections: Array.from(docs.values()).reduce((sum, doc) => sum + doc.conns.size, 0)
    }))
    return
  }

  if (request.url === '/execute' && request.method === 'POST') {
    let body = ''
    request.on('data', chunk => { body += chunk })
    request.on('end', async () => {
      try {
        const req = JSON.parse(body)
        const result = await executeCode(req)
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(result))
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Code execution error:`, err)
        response.writeHead(500, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
          token: 'ws-exec',
          status: { id: 11, description: 'Runtime Error' },
          message: err.message
        }))
      }
    })
    return
  }

  response.writeHead(404)
  response.end('Not Found')
})

const wss = new WebSocket.Server({ server })

// Track connection counts per room for logging
const roomConnectionCounts = new Map()

wss.on('connection', (conn, req) => {
  // Extract room_id from URL path (y-websocket sends room name in path)
  // URL format can be:
  //   - /yjs/room-id (from Caddy proxy without strip_prefix)
  //   - /room-id (direct connection or with strip_prefix)
  let docName = req.url.slice(1).split('?')[0] || 'default-room'

  // Remove /yjs prefix if present (handle both proxy scenarios)
  if (docName.startsWith('yjs/')) {
    docName = docName.slice(4) // Remove 'yjs/' prefix
  }

  // Fallback to default if empty after stripping
  if (!docName || docName === '') {
    docName = 'default-room'
  }

  // Track initial connection count
  const currentCount = roomConnectionCounts.get(docName) || 0
  roomConnectionCounts.set(docName, currentCount + 1)

  // Wrap the connection to intercept messages BEFORE y-websocket sees them
  const originalOn = conn.on.bind(conn)
  let yjsMessageHandler = null

  // Override 'on' and 'addListener' methods to intercept message listeners
  conn.on = conn.addListener = function(event, handler) {
    if (event === 'message') {
      // Store the y-websocket handler
      yjsMessageHandler = handler

      // Replace with our filtering handler
      const filteringHandler = async (message) => {
        // Check if this is a custom JSON message (starts with '{')
        let isCustomMessage = false

        if (Buffer.isBuffer(message) && message.length > 0 && message[0] === 123) { // '{' = 123
          isCustomMessage = true
        } else if (typeof message === 'string' && message.trim().startsWith('{')) {
          isCustomMessage = true
        }

        if (isCustomMessage) {
          try {
            const str = Buffer.isBuffer(message) ? message.toString('utf8') : message
            const data = JSON.parse(str)

            // Handle custom execution messages - don't pass to y-websocket
            if (data.type === 'execute') {
              try {
                const result = await executeCode({
                  source_code: data.source_code,
                  language_id: data.language_id,
                  stdin: data.stdin || ''
                })

                conn.send(JSON.stringify({
                  type: 'execution-result',
                  ...result
                }))
              } catch (execErr) {
                console.error(`[${new Date().toISOString()}] ❌ Code execution error:`, execErr)
                conn.send(JSON.stringify({
                  type: 'execution-result',
                  token: 'ws-exec',
                  status: { id: 11, description: 'Runtime Error' },
                  message: execErr.message
                }))
              }
              return // Don't pass to y-websocket
            }
          } catch (parseErr) {
            // Not our JSON format, pass to y-websocket
          }
        }

        // Pass binary Yjs messages to the original y-websocket handler
        if (yjsMessageHandler) {
          yjsMessageHandler(message)
        }
      }

      return originalOn('message', filteringHandler)
    }
    return originalOn(event, handler)
  }

  // setupWSConnection will use docName to get/create the Yjs document
  // Each unique docName gets its own isolated Yjs document
  setupWSConnection(conn, req, {
    gc: docName !== 'ws/prosemirror-versions'
  })

  // Track when connection closes
  conn.on('close', () => {
    const count = roomConnectionCounts.get(docName) || 1
    roomConnectionCounts.set(docName, count - 1)

    // Clean up if no connections left
    if (count - 1 === 0) {
      roomConnectionCounts.delete(docName)
    }
  })

  conn.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] ❌ WebSocket error in room ${docName}:`, error.message)
  })
})

// Publish headcount updates to Redis Pub/Sub
async function publishHeadcount(count) {
  if (!redisPublisher || !redisConnected) {
    console.warn(`${new Date().toISOString()} Redis not connected, skipping headcount publish`)
    return
  }

  try {
    await redisPublisher.publish('room:chan:headcount', count.toString())
  } catch (err) {
    console.error(`${new Date().toISOString()} Error publishing headcount to Redis:`, err)
  }
}

// Monitor connection count and publish changes (reduced frequency)
// Only log when there are actual changes to reduce noise
let lastStats = { conns: 0, docs: 0 }

setInterval(() => {
  let conns = 0
  const roomStats = {}

  docs.forEach((doc, docName) => {
    const roomConns = doc.conns.size
    conns += roomConns
    if (roomConns > 0) {
      roomStats[docName] = roomConns
    }
  })

  // Only publish if there's a change in connections or room count
  const hasChange = conns !== lastStats.conns || docs.size !== lastStats.docs

  if (hasChange) {
    lastStats = { conns, docs: docs.size }

    // Publish headcount changes to Redis Pub/Sub
    publishHeadcount(conns)
  }
}, 10000) // Check every 10 seconds instead of 3

server.listen(port, '0.0.0.0')

console.log(`[${new Date().toISOString()}] 🚀 Yjs WebSocket Server listening on http://0.0.0.0:${port}`)
console.log(`[${new Date().toISOString()}] 📝 Mode: ${production ? 'PRODUCTION' : 'DEVELOPMENT'}`)
console.log(`[${new Date().toISOString()}] 💾 Redis: ${redisAddr}`)
console.log(`[${new Date().toISOString()}] 🏃 Runner: ${runnerUrl}`)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log(`[${new Date().toISOString()}] 🛑 SIGTERM received, shutting down gracefully...`)

  // Close WebSocket server
  wss.close(() => {
    console.log(`[${new Date().toISOString()}] ✅ WebSocket server closed`)
  })

  // Close Redis connection
  if (redisPublisher) {
    await redisPublisher.quit()
    console.log(`[${new Date().toISOString()}] ✅ Redis connection closed`)
  }

  // Close HTTP server
  server.close(() => {
    console.log(`[${new Date().toISOString()}] ✅ HTTP server closed`)
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log(`[${new Date().toISOString()}] 🛑 SIGINT received, shutting down gracefully...`)
  process.emit('SIGTERM')
})