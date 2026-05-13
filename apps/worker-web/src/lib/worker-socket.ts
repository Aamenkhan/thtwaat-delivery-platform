import { getSocketUrl } from '@repo/web-core/api'
import { io, type Socket } from 'socket.io-client'
import { readWorkerToken } from './worker-session'

let socket: Socket | null = null

export function getWorkerSocket(): Socket {
  if (socket?.connected) return socket
  const token = readWorkerToken()
  const url = getSocketUrl()
  socket = io(url, {
    transports: ['websocket', 'polling'],
    auth: { token: token ?? '' },
    query: token ? { token } : undefined,
    reconnection: true,
    reconnectionDelay: 2000,
  })
  return socket
}

export function disconnectWorkerSocket() {
  socket?.disconnect()
  socket = null
}
