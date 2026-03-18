import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { handleWebhook } from '../services/telegram.service.js'
import { config } from '../lib/config.js'
import { logger } from '../lib/logger.js'

export async function telegramRoutes(app: FastifyInstance) {
  app.post(
    '/webhook',
    {
      config: {
        rateLimit: {
          max: 1000,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const secretHeader = request.headers['x-telegram-bot-api-secret-token'] as string | undefined

      if (config.telegram.webhookSecret && secretHeader !== config.telegram.webhookSecret) {
        logger.warn({ ip: request.ip }, 'Telegram webhook secret mismatch')
        return reply.status(403).send({ error: 'Forbidden' })
      }

      reply.status(200).send({ ok: true })

      handleWebhook(request.body).catch((err) => {
        logger.error(err, 'error handling Telegram webhook')
      })
    }
  )
}
