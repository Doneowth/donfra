
/**
 * @type {any}
 */
const WebSocket = require('ws')
const http = require('http')
const https = require('https')
const StaticServer = require('node-static').Server
const ywsUtils = require('y-websocket/bin/utils')
const setupWSConnection = ywsUtils.setupWSConnection
const docs = ywsUtils.docs
const env = require('lib0/environment')
const nostatic = env.hasParam('--nostatic')
const redis = require('redis')

const production = process.env.PRODUCTION != null
const port = process.env.PORT || 6789

const staticServer = nostatic ? null : new StaticServer('../', { cache: production ? 3600 : false, gzip: production })

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({
      response: 'ok'
    }))
    return
  }

})
const wss = new WebSocket.Server({ server })

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { gc: req.url.slice(1) !== 'ws/prosemirror-versions' })
})

// log some stats
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

  // If the number of connections changes since last check, publish redis key
  if (typeof global.__lastConns === 'undefined') global.__lastConns = -1
  if (conns !== global.__lastConns && process.env.REDIS_URL) {
    global.__lastConns = conns
    try {
      const publisher = redis.createClient({ url: process.env.REDIS_URL })
      publisher.on('error', err => console.error('Redis Client Error', err))

      publisher.connect().then(() => {
        // Store the headcount as a Redis key so it can be retrieved with GET.
        publisher.set('room:state:headcount', conns.toString()).then(() => {
          console.log(`${new Date().toISOString()} Set redis headcount to ${conns}`)
          publisher.quit()
        }).catch(err => {
          console.error(`${new Date().toISOString()} Error setting redis headcount: ${err.message}`)
          publisher.quit()
        })
      }).catch(err => {
        console.error(`${new Date().toISOString()} Error connecting to redis: ${err.message}`)
      })
    } catch (err) {
      console.error(`${new Date().toISOString()} Error updating redis headcount: ${err.message}`)
    }
  }

}, 3000)

server.listen(port, '0.0.0.0')

console.log(`Listening to http://localhost:${port} (${production ? 'production + ' : ''} ${nostatic ? 'no static content' : 'serving static content'})`)
