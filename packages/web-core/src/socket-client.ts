import { io, type Socket } from 'socket.io-client'
import { readTokens } from './auth-storage'
import { getSocketUrl } from './api-client'

export function createRealtimeSocket(): Socket {
  const token = readTokens()?.accessToken
  return io(getSocketUrl(), {
    transports: ['websocket', 'polling'],
    auth: token ? { token } : {},
    autoConnect: true,
    reconnection: true,
  })
}

export function subscribeOrderStatus(
  socket: Socket,
  publicId: string,
  handlers: {
    onStatus?: (payload: unknown) => void
    onTracking?: (payload: unknown) => void
  }
) {
  socket.emit('subscribe:order', publicId)
  if (handlers.onStatus) socket.on('order:status', handlers.onStatus)
  if (handlers.onTracking) socket.on('order:tracking', handlers.onTracking)
  return () => {
    socket.off('order:status', handlers.onStatus)
    socket.off('order:tracking', handlers.onTracking)
  }
}
