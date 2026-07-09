/**
 * Quorum Demo Seed Script
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/seed.js
 *
 * Or if you have a .env.local file, run:
 *   node -e "require('fs').readFileSync('.env.local','utf8').split('\n').forEach(l=>{const[k,...v]=l.split('=');if(k&&!k.startsWith('#'))process.env[k.trim()]=v.join('=').trim()})" scripts/seed.js
 *
 * What this creates:
 *   - 3 demo users (alice, bob, carol) with password "demo1234"
 *   - 4 open markets resolving in 5–20 minutes
 *   - 2 resolved markets (for history page)
 *   - Stakes spread across all markets
 */

const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

// Load .env.local if DATABASE_URL not already set
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
    console.log('Loaded .env.local')
  }
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set.')
  console.error('Run: DATABASE_URL="postgres://..." node scripts/seed.js')
  process.exit(1)
}

const url = new URL(process.env.DATABASE_URL)
const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  database: url.pathname.replace(/^\//, ''),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false },
})

const now = new Date()
const mins = (n) => new Date(now.getTime() + n * 60_000).toISOString()
const minsAgo = (n) => new Date(now.getTime() - n * 60_000).toISOString()

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── Users ──────────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('demo1234', 10)

    const users = [
      { email: 'alice@quorum.demo', display_name: 'Alice', wallet: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' },
      { email: 'bob@quorum.demo',   display_name: 'Bob',   wallet: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG' },
      { email: 'carol@quorum.demo', display_name: 'Carol', wallet: 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC' },
    ]

    const userIds = []
    for (const u of users) {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, display_name, auth_method, wallet_address)
         VALUES ($1, $2, $3, 'email', $4)
         ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, wallet_address = EXCLUDED.wallet_address
         RETURNING id`,
        [u.email, passwordHash, u.display_name, u.wallet]
      )
      userIds.push({ id: rows[0].id, wallet: u.wallet })
      console.log(`User ${u.display_name}: ${rows[0].id}`)
    }

    const [alice, bob, carol] = userIds
    const [aliceId, bobId, carolId] = [alice.id, bob.id, carol.id]

    // ── Open Markets ───────────────────────────────────────────────────────
    const openMarkets = [
      {
        question:     'Will BTC be above $62,000 in 5 minutes?',
        symbol:       'BTCUSDT',
        direction:    'above',
        target_value: 62000,
        resolves_at:  mins(5),
        created_by:   aliceId,
      },
      {
        question:     'Will STX be above $0.42 in 10 minutes?',
        symbol:       'STXUSDT',
        direction:    'above',
        target_value: 0.42,
        resolves_at:  mins(10),
        created_by:   bobId,
      },
      {
        question:     'Will ETH be below $3,200 in 15 minutes?',
        symbol:       'ETHUSDT',
        direction:    'below',
        target_value: 3200,
        resolves_at:  mins(15),
        created_by:   carolId,
      },
      {
        question:     'Will BTC be below $63,000 in 20 minutes?',
        symbol:       'BTCUSDT',
        direction:    'below',
        target_value: 63000,
        resolves_at:  mins(20),
        created_by:   aliceId,
      },
    ]

    const openMarketIds = []
    for (const m of openMarkets) {
      const { rows } = await client.query(
        `INSERT INTO markets
           (question, symbol, direction, target_value, market_type, resolves_at, status, created_by)
         VALUES ($1, $2, $3, $4, 'flash', $5, 'open', $6)
         RETURNING id`,
        [m.question, m.symbol, m.direction, m.target_value, m.resolves_at, m.created_by]
      )
      openMarketIds.push(rows[0].id)
      console.log(`Open market: ${m.question.slice(0, 50)}`)
    }

    // ── Resolved Markets ──────────────────────────────────────────────────
    const resolvedMarkets = [
      {
        question:         'Will BTC be above $60,000 in 5 minutes?',
        symbol:           'BTCUSDT',
        direction:        'above',
        target_value:     60000,
        resolves_at:      minsAgo(10),
        created_by:       bobId,
        status:           'resolved',
        winning_side:     'yes',
        resolution_price: '61234.5678',
        yes_pool:         '15.00',
        no_pool:          '10.00',
      },
      {
        question:         'Will STX be below $0.50 in 15 minutes?',
        symbol:           'STXUSDT',
        direction:        'below',
        target_value:     0.50,
        resolves_at:      minsAgo(20),
        created_by:       carolId,
        status:           'resolved',
        winning_side:     'yes',
        resolution_price: '0.3841',
        yes_pool:         '20.00',
        no_pool:          '5.00',
      },
    ]

    const resolvedMarketIds = []
    for (const m of resolvedMarkets) {
      const { rows } = await client.query(
        `INSERT INTO markets
           (question, symbol, direction, target_value, market_type, resolves_at, status,
            winning_side, resolution_price, yes_pool, no_pool, created_by)
         VALUES ($1, $2, $3, $4, 'flash', $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          m.question, m.symbol, m.direction, m.target_value, m.resolves_at,
          m.status, m.winning_side, m.resolution_price,
          m.yes_pool, m.no_pool, m.created_by,
        ]
      )
      resolvedMarketIds.push(rows[0].id)
      console.log(`Resolved market: ${m.question.slice(0, 50)}`)
    }

    // ── Stakes on open markets ─────────────────────────────────────────────
    const openStakes = [
      { market_id: openMarketIds[0], wallet_address: alice.wallet, side: 'yes', amount: 5.00 },
      { market_id: openMarketIds[0], wallet_address: bob.wallet,   side: 'no',  amount: 3.00 },
      { market_id: openMarketIds[0], wallet_address: carol.wallet, side: 'yes', amount: 2.00 },
      { market_id: openMarketIds[1], wallet_address: bob.wallet,   side: 'yes', amount: 4.00 },
      { market_id: openMarketIds[1], wallet_address: carol.wallet, side: 'no',  amount: 6.00 },
      { market_id: openMarketIds[2], wallet_address: alice.wallet, side: 'no',  amount: 8.00 },
      { market_id: openMarketIds[2], wallet_address: bob.wallet,   side: 'yes', amount: 4.00 },
      { market_id: openMarketIds[3], wallet_address: carol.wallet, side: 'yes', amount: 10.00 },
      { market_id: openMarketIds[3], wallet_address: alice.wallet, side: 'no',  amount: 7.00 },
    ]

    for (const s of openStakes) {
      await client.query(
        `INSERT INTO stakes (market_id, wallet_address, side, amount)
         VALUES ($1, $2, $3, $4)`,
        [s.market_id, s.wallet_address, s.side, s.amount]
      )
    }

    for (const marketId of openMarketIds) {
      await client.query(
        `UPDATE markets SET
           yes_pool = (SELECT COALESCE(SUM(amount),0) FROM stakes WHERE market_id=$1 AND side='yes'),
           no_pool  = (SELECT COALESCE(SUM(amount),0) FROM stakes WHERE market_id=$1 AND side='no')
         WHERE id=$1`,
        [marketId]
      )
    }

    // ── Stakes on resolved markets ─────────────────────────────────────────
    await client.query(
      `INSERT INTO stakes (market_id, wallet_address, side, amount, payout_amount)
       VALUES ($1, $2, 'yes', 10, 14.25), ($1, $3, 'no', 10, 0)`,
      [resolvedMarketIds[0], alice.wallet, bob.wallet]
    )
    await client.query(
      `INSERT INTO stakes (market_id, wallet_address, side, amount, payout_amount)
       VALUES ($1, $2, 'yes', 15, 23.75), ($1, $3, 'no', 5, 0)`,
      [resolvedMarketIds[1], carol.wallet, alice.wallet]
    )

    await client.query('COMMIT')
    console.log('\n✓ Seed complete!')
    console.log('\nDemo credentials (password: demo1234):')
    console.log('  alice@quorum.demo')
    console.log('  bob@quorum.demo')
    console.log('  carol@quorum.demo')
    console.log('\nOpen markets: 4 (resolving in 5–20 min)')
    console.log('Resolved markets: 2 (visible in History)')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed, rolled back:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
