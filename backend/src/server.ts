import { buildApp } from './app.js'
import { config } from './lib/config.js'
import { logger } from './lib/logger.js'
import { registerSocketIO } from './plugins/socketio.js'
import { initTelegramService } from './services/telegram.service.js'
import { runMigrationsOnStartup } from './db/startup.js'

async function main() {
  try {
    await runMigrationsOnStartup()

    const app = await buildApp()

    registerSocketIO(app.server, config.socket.corsOrigin)

    await app.listen({ port: config.port, host: '0.0.0.0' })
    logger.info(`Server listening on port ${config.port}`)

    if (config.telegram.botToken) {
      await initTelegramService()
      logger.info('Telegram bot initialized')
    } else {
      logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram integration disabled')
    }
  } catch (err) {
    logger.error(err, 'Failed to start server')
    process.exit(1)
  }
}

main()
