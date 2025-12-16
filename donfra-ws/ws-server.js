
/**
 * @type {any}
 */
const WebSocket = require('ws')
const http = require('http')
const StaticServer = require('node-static').Server
const ywsUtils = require('y-websocket/bin/utils')
const setupWSConnection = ywsUtils.setupWSConnection
const docs = ywsUtils.docs
const env = require('lib0/environment')
const nostatic = env.hasParam('--nostatic')
const redis = require('redis')

const production = process.env.PRODUCTION != null
const port = process.env.PORT || 6789
const redisAddr = process.env.REDIS_ADDR || 'localhost:6379'

const staticServer = nostatic ? null : new StaticServer('../', { cache: production ? 3600 : false, gzip: production })

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
      response: 'ok',
      redis: redisConnected
    }))
    return
  }

})
const wss = new WebSocket.Server({ server })

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { gc: req.url.slice(1) !== 'ws/prosemirror-versions' })
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

// Monitor connection count and publish changes
setInterval(() => {
  let conns = 0
  docs.forEach(doc => { conns += doc.conns.size })
  const stats = {
    conns,
    docs: docs.size,
    websocket: `ws://localhost:${port}`,
    http: `http://localhost:${port}`
  }
  console.log(`${new Date().toISOString()} Stats: ${JSON.stringify(stats)}`)

  // Publish headcount changes to Redis Pub/Sub
  if (typeof global.__lastConns === 'undefined') global.__lastConns = -1
  if (conns !== global.__lastConns) {
    global.__lastConns = conns
    publishHeadcount(conns)
  }
}, 3000)

server.listen(port, '0.0.0.0')

console.log(`Listening to http://localhost:${port} (${production ? 'production + ' : ''} ${nostatic ? 'no static content' : 'serving static content'})`)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log(`${new Date().toISOString()} SIGTERM received, closing Redis connection...`)
  if (redisPublisher) {
    await redisPublisher.quit()
  }
  process.exit(0)
})