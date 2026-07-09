import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    const { marketId, walletAddress, side, amount, txHash } = await req.json()

    if (!marketId || !walletAddress || !side || !amount || !txHash) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { rows } = await pool.query(
      `SELECT * FROM markets WHERE id = $1 AND status = 'open' AND resolves_at > NOW()`,
      [marketId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Market closed or not found' }, { status: 400 })
    }
    const market = rows[0]

    await pool.query(
      `INSERT INTO stakes (market_id, wallet_address, side, amount, tx_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [marketId, walletAddress, side, amount, txHash]
    )

    const poolColumn = side === 'yes' ? 'yes_pool' : 'no_pool'
    await pool.query(
      `UPDATE markets SET ${poolColumn} = ${poolColumn} + $1 WHERE id = $2`,
      [amount, marketId]
    )

    const trunc = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    sendTelegramMessage(
      `💰 *NEW STAKE*\n\n` +
        `"${market.question}"\n\n` +
        `${trunc} → ${String(side).toUpperCase()} · ${amount} USDCx\n` +
        `Deposit: [View Tx](https://explorer.hiro.so/txid/${txHash}?chain=testnet)`
    ).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording stake:', error)
    return NextResponse.json({ error: 'Failed to record stake' }, { status: 500 })
  }
}
