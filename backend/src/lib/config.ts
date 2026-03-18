function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  allowedOrigins: (process.env.WIDGET_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  databaseUrl: requireEnv('DATABASE_URL'),
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    supportChatId: Number(process.env.TELEGRAM_SUPPORT_CHAT_ID ?? 0),
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  },
  uploads: {
    dir: process.env.UPLOADS_DIR ?? '/uploads',
    maxMb: Number(process.env.MAX_UPLOAD_MB ?? 5),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN ?? '*',
  },
}
