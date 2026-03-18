import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createOrRestoreSession,
  getSessionByIdAndToken,
  updateSessionContact,
} from '../services/session.service.js'
import {
  createVisitorMessage,
  getSessionMessages,
  formatMessageForSocket,
} from '../services/message.service.js'
import { emitToSession } from '../services/socket.service.js'
import {
  forwardVisitorMessage,
  sendContactDetails,
  updateTopicTitle,
} from '../services/telegram.service.js'
import { createSessionBodySchema, sendMessageBodySchema } from '../lib/validators.js'
import { config } from '../lib/config.js'
import { logger } from '../lib/logger.js'

export async function chatRoutes(app: FastifyInstance) {
  app.post(
    '/session',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = createSessionBodySchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: 'Validation Error', message: result.error.message })
      }

      const session = await createOrRestoreSession(result.data)

      return reply.send({
        sessionId: session.id,
        visitorToken: session.visitorToken,
        visitorName: session.visitorName ?? null,
        status: session.status,
      })
    }
  )

  app.get(
    '/session/:sessionId/messages',
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

      const messages = await getSessionMessages(sessionId)
      const formatted = messages.map((m) => formatMessageForSocket(m, config.appBaseUrl))

      return reply.send({
        session: {
          id: session.id,
          status: session.status,
          visitorName: session.visitorName ?? null,
        },
        messages: formatted,
      })
    }
  )

  app.post(
    '/session/:sessionId/messages',
    {
      config: {
        rateLimit: {
          max: 10,
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

      const result = sendMessageBodySchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: 'Validation Error', message: result.error.message })
      }

      const message = await createVisitorMessage(
        sessionId,
        result.data.text,
        result.data.attachmentId
      )

      const formatted = formatMessageForSocket(message, config.appBaseUrl)

      forwardVisitorMessage(session, message).catch((err) => {
        logger.error(err, 'failed to forward message to Telegram')
      })

      emitToSession(sessionId, 'message_sent', { message: formatted })

      return reply.send({ message: formatted })
    }
  )

  app.post(
    '/session/:sessionId/contact',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
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

      const contactSchema = z
        .object({
          name: z.string().min(1).max(255).optional(),
          email: z.string().email().max(255).optional(),
        })
        .refine((d) => d.name || d.email, {
          message: 'Provide at least a name or email',
        })

      const result = contactSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: 'Validation Error', message: result.error.message })
      }

      const updated = await updateSessionContact(
        sessionId,
        result.data.name ?? null,
        result.data.email ?? null
      )

      sendContactDetails(updated, result.data.name ?? null, result.data.email ?? null).catch(
        (err) => logger.error(err, 'failed to send contact details to Telegram')
      )

      if (result.data.name && updated.telegramTopicId) {
        updateTopicTitle(updated).catch((err) =>
          logger.error(err, 'failed to update Telegram topic title')
        )
      }

      emitToSession(sessionId, 'visitor_name_updated', {
        visitorName: updated.visitorName ?? null,
      })

      return reply.send({
        session: {
          id: updated.id,
          visitorName: updated.visitorName ?? null,
          visitorEmail: updated.visitorEmail ?? null,
        },
      })
    }
  )
}
