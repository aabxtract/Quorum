import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getPrice } from '@/lib/price'
import { getAgentReasoning } from '@/lib/groq'
import { resolveMarketOnChain, markPaidOutOnChain } from '@/lib/quorum-agent'
import { payoutWinner, getAgentVault } from '@/lib/flowvault-agent'
import { sendTelegramMessage } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { rows: markets } = await getPool().query(`
    SELECT * FROM markets
    WHERE status = 'open'
    AND resolves_at <= NOW()
    ORDER BY resolves_at ASC
    LIMIT 5
  `)

  if (markets.length === 0) {
    return NextResponse.json({ message: 'No markets to resolve' })
  }

  const results = []

  for (const market of markets) {
    try {
      await getPool().query(`UPDATE markets SET status = 'resolving' WHERE id = $1`, [market.id])

      const currentPrice = await getPrice(market.symbol)

      const condition =
        market.direction === 'above'
          ? currentPrice > parseFloat(market.target_value)
          : currentPrice < parseFloat(market.target_value)
      const winningSide: 'yes' | 'no' = condition ? 'yes' : 'no'
      const losingSide:  'yes' | 'no' = winningSide === 'yes' ? 'no' : 'yes'

      const winnerPool = parseFloat(market[`${winningSide}_pool`])
      const loserPool  = parseFloat(market[`${losingSide}_pool`])
      const totalPool  = winnerPool + loserPool

      const reasoning = await getAgentReasoning({
        question: market.question,
        currentPrice,
        targetValue: parseFloat(market.target_value),
        direction: market.direction,
        winningSide,
      })

      await getPool().query(
        `INSERT INTO agent_log (market_id, action, price_at_resolution, reasoning)
         VALUES ($1, $2, $3, $4)`,
        [market.id, `RESOLVED_${winningSide.toUpperCase()}`, currentPrice, reasoning]
      )

      // ── On-chain registry: mark resolved ──────────────────────────────────────
      let resolveTxHash: string | null = null
      try {
        resolveTxHash = await resolveMarketOnChain(market.id, winningSide, currentPrice)
      } catch (chainErr: any) {
        console.error(`[resolve] on-chain registry failed for ${market.id}:`, chainErr?.message)
      }

      // ── FlowVault: pay winners from agent vault ────────────────────────────────
      const payoutTxs: { stakeId: string; txId: string; amount: number }[] = []

      if (totalPool > 0 && winnerPool > 0) {
        const { rows: winnerStakes } = await getPool().query(
          `SELECT id, wallet_address, amount FROM stakes WHERE market_id = $1 AND side = $2`,
          [market.id, winningSide]
        )

        for (const stake of winnerStakes) {
          const stakeAmount = parseFloat(stake.amount)
          const profit = loserPool > 0 ? (stakeAmount / winnerPool) * (loserPool * 0.95) : 0
          const payout = stakeAmount + profit

          try {
            // FlowVault routing: agent vault → winner wallet
            const txId = await payoutWinner(stake.wallet_address, payout)
            payoutTxs.push({ stakeId: stake.id, txId, amount: payout })
            await getPool().query(
              `UPDATE stakes SET payout_amount = $1, payout_tx_hash = $2 WHERE id = $3`,
              [payout, txId, stake.id]
            )

            // Record on-chain that this winner was paid
            try {
              await markPaidOutOnChain(market.id, stake.wallet_address)
            } catch (chainErr: any) {
              console.error(`[resolve] mark-paid-out failed for stake ${stake.id}:`, chainErr?.message)
            }
          } catch (payoutErr: any) {
            console.error(`[resolve] FlowVault payout failed for stake ${stake.id}:`, payoutErr?.message)
            await getPool().query(
              `UPDATE stakes SET payout_amount = $1 WHERE id = $2`,
              [payout, stake.id]
            )
          }
        }

        // Final cleanup — payoutWinner already clears after each payout,
        // but clear once more in case the loop exited early on error.
        try { await getAgentVault().clearRoutingRules() } catch {}
      } else if (totalPool > 0 && winnerPool === 0) {
        // Everyone on losing side — nothing to pay out, fee stays in vault
      }

      // ── Always persist to DB ───────────────────────────────────────────────────
      await getPool().query(
        `UPDATE markets SET
           status = 'resolved',
           winning_side = $1,
           resolution_price = $2,
           agent_reasoning = $3,
           settlement_tx_hash = $4
         WHERE id = $5`,
        [winningSide, currentPrice, reasoning, resolveTxHash, market.id]
      )

      // ── Always notify Telegram ─────────────────────────────────────────────────
      const explorerLink = resolveTxHash
        ? `[View Tx](https://explorer.hiro.so/txid/${resolveTxHash}?chain=testnet)`
        : '_Registry tx pending_'

      await sendTelegramMessage(
        `🏆 *MARKET RESOLVED*\n\n` +
          `"${market.question}"\n\n` +
          `*${winningSide.toUpperCase()} WINS* @ $${currentPrice}\n` +
          `Total pool: ${totalPool} USDCx\n` +
          `Winners paid: ${payoutTxs.length}\n\n` +
          `🤖 ${reasoning}\n\n` +
          `${explorerLink}`
      )

      results.push({ marketId: market.id, winningSide, resolveTxHash, payouts: payoutTxs.length })
    } catch (error: any) {
      console.error(`[resolve] failed for market ${market.id}:`, error)
      await getPool().query(`UPDATE markets SET status = 'open' WHERE id = $1`, [market.id])
    }
  }

  return NextResponse.json({ resolved: results })
}
