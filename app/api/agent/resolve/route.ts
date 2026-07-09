import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getPrice } from '@/lib/price'
import { getAgentReasoning } from '@/lib/groq'
import {
  executeAtomicSettlement,
  payoutWinner,
  agentVault,
} from '@/lib/flowvault-agent'
import { sendTelegramMessage } from '@/lib/telegram'

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
      await getPool().query(
        `UPDATE markets SET status = 'resolving' WHERE id = $1`,
        [market.id]
      )

      const currentPrice = await getPrice(market.symbol)

      const condition =
        market.direction === 'above'
          ? currentPrice > parseFloat(market.target_value)
          : currentPrice < parseFloat(market.target_value)
      const winningSide = condition ? 'yes' : 'no'
      const losingSide = winningSide === 'yes' ? 'no' : 'yes'

      const totalPool = parseFloat(market.yes_pool) + parseFloat(market.no_pool)
      const winnerPool = parseFloat(market[`${winningSide}_pool`])
      const loserPool = parseFloat(market[`${losingSide}_pool`])

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

      let settleTxHash: string | null = null
      const payoutTxs: { stakeId: string; txId: string; amount: number }[] = []

      // Only touch FlowVault if there was actual money in the market
      if (totalPool > 0) {
        settleTxHash = await executeAtomicSettlement({
          totalPool,
          winnerPool,
          loserPool,
          winnerAddress: process.env.TREASURY_WALLET || '',
        })

        // Distribute winner payouts one-by-one via routing rules.
        if (winnerPool > 0 && loserPool > 0) {
          const { rows: winnerStakes } = await getPool().query(
            `SELECT id, wallet_address, amount FROM stakes
              WHERE market_id = $1 AND side = $2`,
            [market.id, winningSide]
          )

          for (const stake of winnerStakes) {
            const stakeAmount = parseFloat(stake.amount)
            const profit = (stakeAmount / winnerPool) * (loserPool * 0.95)
            const payout = stakeAmount + profit

            try {
              const txId = await payoutWinner(stake.wallet_address, payout)
              payoutTxs.push({ stakeId: stake.id, txId, amount: payout })
              await getPool().query(
                `UPDATE stakes SET payout_amount = $1, payout_tx_hash = $2 WHERE id = $3`,
                [payout, txId, stake.id]
              )
            } catch (payoutErr) {
              console.error(
                `Payout failed for stake ${stake.id} (${stake.wallet_address}):`,
                payoutErr
              )
              // Record the calculated amount even if the tx failed, so it can
              // be retried / claimed later.
              await getPool().query(
                `UPDATE stakes SET payout_amount = $1 WHERE id = $2`,
                [payout, stake.id]
              )
            }
          }

          // Clear rules once at the end to reset agent vault state
          try {
            await agentVault.clearRoutingRules()
          } catch (e) {
            console.error('Failed to clear routing rules after payouts:', e)
          }
        } else if (winnerPool > 0 && loserPool === 0) {
          // Everyone was on the winning side — just refund principal.
          const { rows: winnerStakes } = await getPool().query(
            `SELECT id, wallet_address, amount FROM stakes
              WHERE market_id = $1 AND side = $2`,
            [market.id, winningSide]
          )
          for (const stake of winnerStakes) {
            const amt = parseFloat(stake.amount)
            try {
              const txId = await payoutWinner(stake.wallet_address, amt)
              payoutTxs.push({ stakeId: stake.id, txId, amount: amt })
              await getPool().query(
                `UPDATE stakes SET payout_amount = $1, payout_tx_hash = $2 WHERE id = $3`,
                [amt, txId, stake.id]
              )
            } catch (e) {
              console.error(`Refund failed for stake ${stake.id}:`, e)
              await getPool().query(
                `UPDATE stakes SET payout_amount = $1 WHERE id = $2`,
                [amt, stake.id]
              )
            }
          }
          try { await agentVault.clearRoutingRules() } catch {}
        }
      }

      await getPool().query(
        `UPDATE markets SET
           status = 'resolved',
           winning_side = $1,
           resolution_price = $2,
           agent_reasoning = $3,
           settlement_tx_hash = $4
         WHERE id = $5`,
        [winningSide, currentPrice, reasoning, settleTxHash, market.id]
      )

      const explorerLink = settleTxHash
        ? `https://explorer.hiro.so/txid/${settleTxHash}?chain=testnet`
        : 'No funds staked'

      await sendTelegramMessage(
        `🏆 *MARKET RESOLVED*\n\n` +
          `"${market.question}"\n\n` +
          `*${winningSide.toUpperCase()} WINS*\n` +
          `Price at resolution: $${currentPrice}\n` +
          `Total pool: ${totalPool} USDCx\n` +
          `Winners paid: ${payoutTxs.length}\n\n` +
          `🤖 Agent: ${reasoning}\n\n` +
          `Settlement: [View Tx](${explorerLink})`
      )

      results.push({
        marketId: market.id,
        winningSide,
        settleTxHash,
        payouts: payoutTxs.length,
      })
    } catch (error) {
      console.error(`Failed to resolve market ${market.id}:`, error)
      await getPool().query(
        `UPDATE markets SET status = 'open' WHERE id = $1`,
        [market.id]
      )
    }
  }

  return NextResponse.json({ resolved: results })
}
