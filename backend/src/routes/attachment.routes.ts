import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getSessionByIdAndToken } from '../services/session.service.js'
import { saveUploadedFile } from '../services/upload.service.js'
import { logger } from '../lib/logger.js'

export async function attachmentRoutes(app: FastifyInstance) {
  app.post(
    '/session/:sessionId/attachments',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) =>
            (req.headers['visitor-token'] as string) ?? req.ip,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId } = request.params as { sessionId: string }
      const visitorToken = request.headers['visitor-token'] as string | undefined

      if (!visitorToken) {
        return reply.status(401).send({ error: 'Missing visitor-token header' })
      }

      const session = await getSessionByIdAndToken(sessionId, visitorToken)
      if (!session) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      const buffer = await data.toBuffer()

      logger.debug({ filename: data.filename, mimetype: data.mimetype }, 'upload received')

      const attachment = await saveUploadedFile({
        buffer,
        originalFilename: data.filename,
        mimeType: data.mimetype,
        sessionId,
      })

      return reply.send({ attachment })
    }
  )
}
