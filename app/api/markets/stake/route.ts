import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { marketId, walletAddress, side, amount, txHash } = await req.json()

    if (!marketId || !walletAddress || !side || !amount || !txHash) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Check market is still open
    const { rows } = await pool.query(
      `SELECT * FROM markets WHERE id = $1 AND status = 'open' AND resolves_at > NOW()`,
      [marketId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Market closed or not found' }, { status: 400 })
    }

    // Record stake
    await pool.query(`
      INSERT INTO stakes (market_id, wallet_address, side, amount, flowvault_tx_hash)
      VALUES ($1, $2, $3, $4, $5)
    `, [marketId, walletAddress, side, amount, txHash])

    // Update pool totals
    const poolColumn = side === 'yes' ? 'yes_pool' : 'no_pool'
    await pool.query(
      `UPDATE markets SET ${poolColumn} = ${poolColumn} + $1 WHERE id = $2`,
      [amount, marketId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording stake:', error)
    return NextResponse.json({ error: 'Failed to record stake' }, { status: 500 })
  }
}
