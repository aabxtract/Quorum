import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pool = getPool()
  const client = await pool.connect()

  const now = new Date()
  const mins = (n: number) => new Date(now.getTime() + n * 60_000).toISOString()
  const minsAgo = (n: number) => new Date(now.getTime() - n * 60_000).toISOString()

  try {
    await client.query('BEGIN')

    const passwordHash = await bcrypt.hash('demo1234', 10)

    const demoUsers = [
      { email: 'alice@quorum.demo', display_name: 'Alice', wallet: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' },
      { email: 'bob@quorum.demo',   display_name: 'Bob',   wallet: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG' },
      { email: 'carol@quorum.demo', display_name: 'Carol', wallet: 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC' },
    ]

    const users: { id: string; wallet: string }[] = []
    for (const u of demoUsers) {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, display_name, auth_method, wallet_address)
         VALUES ($1, $2, $3, 'email', $4)
         ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, wallet_address = EXCLUDED.wallet_address
         RETURNING id`,
        [u.email, passwordHash, u.display_name, u.wallet]
      )
      users.push({ id: rows[0].id, wallet: u.wallet })
    }

    const [alice, bob, carol] = users
    const [aliceId, bobId, carolId] = [alice.id, bob.id, carol.id]

    const openMarkets = [
      { question: 'Will BTC be above $62,000 in 5 minutes?',  symbol: 'BTCUSDT', direction: 'above', target_value: 62000, resolves_at: mins(5),  created_by: aliceId },
      { question: 'Will STX be above $0.42 in 10 minutes?',   symbol: 'STXUSDT', direction: 'above', target_value: 0.42,  resolves_at: mins(10), created_by: bobId   },
      { question: 'Will ETH be below $3,200 in 15 minutes?',  symbol: 'ETHUSDT', direction: 'below', target_value: 3200,  resolves_at: mins(15), created_by: carolId },
      { question: 'Will BTC be below $63,000 in 20 minutes?', symbol: 'BTCUSDT', direction: 'below', target_value: 63000, resolves_at: mins(20), created_by: aliceId },
    ]

    const openMarketIds: string[] = []
    for (const m of openMarkets) {
      const { rows } = await client.query(
        `INSERT INTO markets
           (question, symbol, direction, target_value, market_type, resolves_at, status, created_by)
         VALUES ($1, $2, $3, $4, 'flash', $5, 'open', $6)
         RETURNING id`,
        [m.question, m.symbol, m.direction, m.target_value, m.resolves_at, m.created_by]
      )
      openMarketIds.push(rows[0].id)
    }

    const resolvedMarkets = [
      {
        question: 'Will BTC be above $60,000 in 5 minutes?',
        symbol: 'BTCUSDT', direction: 'above', target_value: 60000,
        resolves_at: minsAgo(10), status: 'resolved',
        winning_side: 'yes', resolution_price: '61234.5678',
        yes_pool: '15.00', no_pool: '10.00', created_by: bobId,
      },
      {
        question: 'Will STX be below $0.50 in 15 minutes?',
        symbol: 'STXUSDT', direction: 'below', target_value: 0.50,
        resolves_at: minsAgo(20), status: 'resolved',
        winning_side: 'yes', resolution_price: '0.3841',
        yes_pool: '20.00', no_pool: '5.00', created_by: carolId,
      },
    ]

    const resolvedMarketIds: string[] = []
    for (const m of resolvedMarkets) {
      const { rows } = await client.query(
        `INSERT INTO markets
           (question, symbol, direction, target_value, market_type, resolves_at, status,
            winning_side, resolution_price, yes_pool, no_pool, created_by)
         VALUES ($1, $2, $3, $4, 'flash', $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [m.question, m.symbol, m.direction, m.target_value, m.resolves_at,
         m.status, m.winning_side, m.resolution_price, m.yes_pool, m.no_pool, m.created_by]
      )
      resolvedMarketIds.push(rows[0].id)
    }

    // Stakes on open markets
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
        `INSERT INTO stakes (market_id, wallet_address, side, amount) VALUES ($1, $2, $3, $4)`,
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

    // Stakes on resolved markets (with payouts)
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

    return NextResponse.json({
      ok: true,
      users: demoUsers.map(u => u.email),
      open_markets: openMarketIds.length,
      resolved_markets: resolvedMarketIds.length,
    })
  } catch (err: any) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: err.message }, { status: 500 })
  } finally {
    client.release()
  }
}
