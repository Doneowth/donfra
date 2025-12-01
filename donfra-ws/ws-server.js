
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
  // If the number of connections changed since last check, POST headcount to API
  if (typeof global.__lastConns === 'undefined') global.__lastConns = -1
  if (conns !== global.__lastConns) {
    global.__lastConns = conns
    const updateUrl = process.env.ROOM_UPDATE_URL || 'http://localhost:8080/api/room/update-people'
    try {
      const payload = JSON.stringify({ headcount: conns })
      const u = new URL(updateUrl)
      const options = {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }

      const reqLib = u.protocol === 'https:' ? https : http
      const req = reqLib.request(options, res => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { body += chunk })
        res.on('end', () => {
          console.log(`${new Date().toISOString()} Posted headcount ${conns} to ${updateUrl}: ${body}`)
        })
      })
      req.on('error', err => {
        console.error(`${new Date().toISOString()} Error posting to ${updateUrl}: ${err.message}`)
      })
      req.write(payload)
      req.end()
    } catch (err) {
      console.error(`${new Date().toISOString()} Error building request for ${updateUrl}: ${err.message}`)
    }
  }
}, 3000)

server.listen(port, '0.0.0.0')

console.log(`Listening to http://localhost:${port} (${production ? 'production + ' : ''} ${nostatic ? 'no static content' : 'serving static content'})`)
