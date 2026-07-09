import { Pool } from 'pg'

const globalForPg = globalThis as typeof globalThis & { __pgPool?: Pool }

function getOrCreatePool(): Pool {
  if (!globalForPg.__pgPool) {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    const url = new URL(dbUrl)
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

const pool = new Proxy({} as Pool, {
  get(_, prop) {
    const instance = getOrCreatePool()
    const val = (instance as any)[prop]
    return typeof val === 'function' ? val.bind(instance) : val
  },
})

export default pool
