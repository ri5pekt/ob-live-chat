import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const migrationClient = postgres(databaseUrl, { max: 1 })

async function runMigrations() {
  console.log('Running database migrations...')
  const db = drizzle(migrationClient)
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  console.log('Migrations complete.')
  await migrationClient.end()
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
