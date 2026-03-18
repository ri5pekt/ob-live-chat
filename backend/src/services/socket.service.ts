import type { Server as SocketIOServer } from 'socket.io'
import { logger } from '../lib/logger.js'

let io: SocketIOServer | null = null

export function setSocketIO(server: SocketIOServer): void {
  io = server
}

export function emitToSession(sessionId: string, event: string, data: unknown): void {
  if (!io) {
    logger.warn('Socket.IO not initialized — cannot emit event')
    return
  }
  io.to(`chat_session_${sessionId}`).emit(event, data)
}
