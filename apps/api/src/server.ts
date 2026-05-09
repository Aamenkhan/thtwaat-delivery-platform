import { createServer } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { Server as IOServer } from 'socket.io'
import { createApp } from './app.js'
import { setSocketServer } from './lib/socket-registry.js'

const app = createApp()
const server = createServer(getRequestListener(app.fetch))

const io = new IOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  },
})

setSocketServer(io)

io.on('connection', (socket) => {
  socket.emit('hello', { message: 'logistics realtime channel' })
})

const port = Number(process.env.PORT) || 4000

server.listen(port, () => {
  console.log(`API + Socket.IO listening on http://localhost:${port}`)
})
