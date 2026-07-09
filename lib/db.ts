import { Pool } from 'pg'

const globalForPg = globalThis as typeof globalThis & { __pgPool?: Pool }

export function getPool(): Pool {
  if (!globalForPg.__pgPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    const url = new URL(process.env.DATABASE_URL)
    globalForPg.__pgPool = new Pool({
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    } as any)
  }
  return globalForPg.__pgPool
}
