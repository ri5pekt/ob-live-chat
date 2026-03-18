import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import path from 'path'
import { config } from './lib/config.js'
import { logger } from './lib/logger.js'
import { chatRoutes } from './routes/chat.routes.js'
import { attachmentRoutes } from './routes/attachment.routes.js'
import { telegramRoutes } from './routes/telegram.routes.js'

export async function buildApp() {
  const app = Fastify({
    logger: false,
  })

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'visitor-token', 'ngrok-skip-browser-warning'],
    credentials: false,
  })

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
  })

  await app.register(multipart, {
    limits: {
      fileSize: config.uploads.maxMb * 1024 * 1024,
    },
  })

  await app.register(staticFiles, {
    root: config.uploads.dir,
    prefix: '/uploads/',
  })

  await app.register(staticFiles, {
    root: '/widget-dist',
    prefix: '/widget/',
    decorateReply: false,
  })

  app.addHook('onRequest', (request, _reply, done) => {
    logger.debug({ method: request.method, url: request.url }, 'incoming request')
    done()
  })

  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url }, 'request error')

    const statusCode = error.statusCode ?? 500

    if (error.validation) {
      reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
        statusCode: 400,
      })
      return
    }

    reply.status(statusCode).send({
      error: error.name ?? 'Internal Server Error',
      message: statusCode < 500 ? error.message : 'Internal server error',
      statusCode,
    })
  })

  app.get('/health', async () => ({ ok: true }))

  await app.register(chatRoutes, { prefix: '/api/chat' })
  await app.register(attachmentRoutes, { prefix: '/api/chat' })
  await app.register(telegramRoutes, { prefix: '/api/telegram' })

  return app
}
