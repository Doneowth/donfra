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

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({
      status: 'ok',
      redis: redisConnected,
      rooms: docs.size,
      connections: Array.from(docs.values()).reduce((sum, doc) => sum + doc.conns.size, 0)
    }))
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
  // URL format: /room-id (UUID format after our changes)
  const docName = req.url.slice(1).split('?')[0] || 'default-room'

  console.log(`[${new Date().toISOString()}] 🔗 New connection to room: ${docName}`)

  // Track initial connection count
  const currentCount = roomConnectionCounts.get(docName) || 0
  roomConnectionCounts.set(docName, currentCount + 1)

  // setupWSConnection will use docName to get/create the Yjs document
  // Each unique docName gets its own isolated Yjs document
  setupWSConnection(conn, req, {
    gc: docName !== 'ws/prosemirror-versions'
  })

  // Log when connection closes
  conn.on('close', () => {
    const count = roomConnectionCounts.get(docName) || 1
    roomConnectionCounts.set(docName, count - 1)

    // Clean up if no connections left
    if (count - 1 === 0) {
      roomConnectionCounts.delete(docName)
    }

    console.log(`[${new Date().toISOString()}] 🔌 Connection closed for room: ${docName} (remaining: ${count - 1})`)
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
    console.log(`${new Date().toISOString()} Published headcount ${count} to Redis channel 'room:chan:headcount'`)
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

  // Only log if there's a change in connections or room count
  const hasChange = conns !== lastStats.conns || docs.size !== lastStats.docs

  if (hasChange) {
    const stats = {
      connections: conns,
      rooms: docs.size,
      roomDetails: roomStats
    }
    console.log(`[${new Date().toISOString()}] 📊 Stats updated:`, JSON.stringify(stats))
    lastStats = { conns, docs: docs.size }

    // Publish headcount changes to Redis Pub/Sub
    publishHeadcount(conns)
  }
}, 10000) // Check every 10 seconds instead of 3

server.listen(port, '0.0.0.0')

console.log(`[${new Date().toISOString()}] 🚀 Yjs WebSocket Server listening on http://0.0.0.0:${port}`)
console.log(`[${new Date().toISOString()}] 📝 Mode: ${production ? 'PRODUCTION' : 'DEVELOPMENT'}`)
console.log(`[${new Date().toISOString()}] 💾 Redis: ${redisAddr}`)

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