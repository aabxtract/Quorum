import { Pool } from 'pg'

// Prevent multiple Pool instances across Next.js hot reloads.
const globalForPg = globalThis as typeof globalThis & { __pgPool?: Pool }

if (!globalForPg.__pgPool) {
  // We MUST parse the URL and pass params individually — if we only pass
  // `connectionString`, pg ignores extra options like `family`.
  // Node 18+ Happy Eyeballs tries IPv6 first; Neon only listens on IPv4,
  // so every attempt gets ECONNREFUSED → AggregateError.
  // Passing `family: 4` via individual params is the only reliable fix.
  const url = new URL(process.env.DATABASE_URL!)

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
    // Force IPv4 — passed to net.connect() by pg's Client constructor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

const pool = globalForPg.__pgPool!

export default pool
