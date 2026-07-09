import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { payoutWinnerOnChain } from '@/lib/quorum-agent'
import { sendTelegramMessage } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Retry winning stakes that have a calculated payout_amount but no on-chain
// payout_tx_hash (e.g. the original payout tx failed or the agent was down).
//
// Auth: Authorization: Bearer CRON_SECRET
// Query params:
//   ?dry=1         — preview without hitting the chain
//   ?marketId=UUID — restrict to one market
//   ?limit=N       — cap per call (default 20)

async function handle(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dry      = url.searchParams.get('dry') === '1'
  const marketId = url.searchParams.get('marketId')
  const limit    = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10) || 20))

  const params: any[] = [limit]
  let where = `m.status = 'resolved'
               AND s.side = m.winning_side
               AND s.payout_amount IS NOT NULL
               AND s.payout_amount::numeric > 0
               AND (s.payout_tx_hash IS NULL OR s.payout_tx_hash = '')`
  if (marketId) {
    params.push(marketId)
    where += ` AND s.market_id = $${params.length}`
  }

  const { rows: pending } = await getPool().query(
    `SELECT s.id, s.market_id, s.wallet_address, s.side, s.payout_amount, m.question
       FROM stakes s
       JOIN markets m ON s.market_id = m.id
      WHERE ${where}
      ORDER BY s.created_at ASC
      LIMIT $1`,
    params
  )

  if (pending.length === 0) {
    return NextResponse.json({ pending: 0, message: 'No unpaid winners' })
  }

  if (dry) {
    return NextResponse.json({
      pending: pending.length,
      dry: true,
      preview: pending.map((p) => ({
        stakeId: p.id,
        marketId: p.market_id,
        wallet: p.wallet_address,
        payout: parseFloat(p.payout_amount),
      })),
    })
  }

  const results: {
    stakeId: string
    wallet: string
    payout: number
    txId?: string
    error?: string
  }[] = []
  let succeeded = 0
  let failed = 0

  for (const stake of pending) {
    const payout = parseFloat(stake.payout_amount)
    const side   = stake.side as 'yes' | 'no'
    try {
      const txId = await payoutWinnerOnChain(stake.market_id, stake.wallet_address, payout, side)
      await getPool().query(
        `UPDATE stakes SET payout_tx_hash = $1 WHERE id = $2`,
        [txId, stake.id]
      )
      results.push({ stakeId: stake.id, wallet: stake.wallet_address, payout, txId })
      succeeded++
    } catch (err: any) {
      results.push({
        stakeId: stake.id,
        wallet: stake.wallet_address,
        payout,
        error: err?.message || String(err),
      })
      failed++
    }
  }

  if (succeeded > 0) {
    sendTelegramMessage(
      `🔁 *Payout Retry*\n\n` +
        `Retried: ${pending.length}\n` +
        `Delivered: ${succeeded}\n` +
        `Still failing: ${failed}`
    ).catch(() => {})
  }

  return NextResponse.json({ pending: pending.length, succeeded, failed, results })
}

export const GET  = handle
export const POST = handle
