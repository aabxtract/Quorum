import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { recordStakeOnChain } from '@/lib/quorum-agent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { marketId, walletAddress, side, amount, txHash } = await req.json()

    if (!marketId || !walletAddress || !side || !amount || !txHash) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { rows } = await getPool().query(
      `SELECT * FROM markets WHERE id = $1 AND status = 'open' AND resolves_at > NOW()`,
      [marketId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Market closed or not found' }, { status: 400 })
    }
    const market = rows[0]

    // One stake per (market, wallet, side). Top-ups come later.
    const dup = await getPool().query(
      `SELECT id FROM stakes
        WHERE market_id = $1 AND wallet_address = $2 AND side = $3
        LIMIT 1`,
      [marketId, walletAddress, side]
    )
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { error: `You've already staked ${String(side).toUpperCase()} on this market.` },
        { status: 409 }
      )
    }

    try {
      await getPool().query(
        `INSERT INTO stakes (market_id, wallet_address, side, amount, tx_hash)
         VALUES ($1, $2, $3, $4, $5)`,
        [marketId, walletAddress, side, amount, txHash]
      )
    } catch (insertErr: any) {
      // Postgres unique_violation — race between two concurrent stakes
      if (insertErr?.code === '23505') {
        return NextResponse.json(
          { error: `You've already staked ${String(side).toUpperCase()} on this market.` },
          { status: 409 }
        )
      }
      throw insertErr
    }

    const poolColumn = side === 'yes' ? 'yes_pool' : 'no_pool'
    await getPool().query(
      `UPDATE markets SET ${poolColumn} = ${poolColumn} + $1 WHERE id = $2`,
      [amount, marketId]
    )

    // Record stake on-chain registry (non-blocking — don't fail the request if it errors)
    try {
      await recordStakeOnChain(marketId, walletAddress, side, parseFloat(amount))
    } catch (chainErr: any) {
      console.error(`[stake] on-chain record-stake failed: ${chainErr?.message}`)
    }

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
