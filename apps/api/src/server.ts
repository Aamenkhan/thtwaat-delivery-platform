import './load-env.js'
import http from 'node:http'
import { createApp } from './app.js'
import { initRealtimeServer } from './lib/realtime.js'

const port = Number(process.env.PORT) || 4000
const app = createApp()
const server = http.createServer(app)

initRealtimeServer(server)

server.listen(port, () => {
  console.log(`Thtwaat Delivery API + Socket.IO on http://localhost:${port}`)
})
