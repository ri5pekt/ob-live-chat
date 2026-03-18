import { Server as SocketIOServer } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { setSocketIO } from '../services/socket.service.js'
import { getSessionByIdAndToken } from '../services/session.service.js'
import { logger } from '../lib/logger.js'

export function registerSocketIO(httpServer: HttpServer, corsOrigin: string): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  })

  setSocketIO(io)

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'socket connected')

    socket.on('session_join', async (data: { sessionId: string; visitorToken: string }) => {
      try {
        if (!data?.sessionId || !data?.visitorToken) {
          socket.emit('session_join_error', { error: 'Invalid session' })
          socket.disconnect()
          return
        }

        const session = await getSessionByIdAndToken(data.sessionId, data.visitorToken)

        if (!session) {
          logger.warn({ sessionId: data.sessionId }, 'socket join rejected — invalid session/token')
          socket.emit('session_join_error', { error: 'Invalid session' })
          socket.disconnect()
          return
        }

        const room = `chat_session_${session.id}`
        await socket.join(room)
        socket.emit('session_joined', { sessionId: session.id, status: session.status })
        logger.debug({ socketId: socket.id, sessionId: session.id }, 'socket joined session room')
      } catch (err) {
        logger.error(err, 'error during session_join')
        socket.emit('session_join_error', { error: 'Server error' })
        socket.disconnect()
      }
    })

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'socket disconnected')
    })
  })

  logger.info('Socket.IO registered')

  return io
}
