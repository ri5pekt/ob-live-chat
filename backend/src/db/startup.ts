import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { logger } from '../lib/logger.js'
import { config } from '../lib/config.js'
import { fileURLToPath } from 'url'
import path from 'path'

export async function runMigrationsOnStartup(): Promise<void> {
  const client = postgres(config.databaseUrl, { max: 1 })
  try {
    logger.info('Running database migrations...')
    const db = drizzle(client)
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') })
    logger.info('Database migrations complete.')
  } finally {
    await client.end()
  }
}
