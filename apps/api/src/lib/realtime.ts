import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { domainEvents } from './events.js'
import { verifyAccessToken } from './jwt.js'

let io: Server | null = null

function extractBearerToken(socket: {
  handshake: {
    auth: unknown
    headers: { authorization?: string }
  }
}): string | undefined {
  const auth = socket.handshake.auth as { token?: string } | undefined
  if (typeof auth?.token === 'string' && auth.token.length > 0) {
    return auth.token
  }
  const h = socket.handshake.headers.authorization
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim()
  return undefined
}

export function initRealtimeServer(httpServer: HttpServer) {
  if (io) return
  const requireSocketAuth = process.env.SOCKET_REQUIRE_AUTH === '1'

  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true },
  })

  io.use((socket, next) => {
    const token = extractBearerToken(socket)
    if (!token) {
      if (requireSocketAuth) {
        next(new Error('Unauthorized'))
        return
      }
      next()
      return
    }
    try {
      const payload = verifyAccessToken(token)
      socket.data.userId = payload.sub
      socket.data.role = payload.role
      void socket.join(`user:${payload.sub}`)
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    socket.on('subscribe:order', (publicId: unknown) => {
      if (typeof publicId === 'string' && publicId.length > 0) {
        void socket.join(`order:${publicId}`)
      }
    })
  })

  domainEvents.on('order:status:changed', (p) => {
    io?.to(`order:${p.publicId}`).emit('order:status', p)
  })

  domainEvents.on('order:tracking:updated', (p) => {
    io?.to(`order:${p.publicId}`).emit('order:tracking', p)
  })
}
