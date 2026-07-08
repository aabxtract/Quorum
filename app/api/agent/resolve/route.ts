import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getPrice } from '@/lib/price'
import { getAgentReasoning } from '@/lib/groq'
import { executeAtomicSettlement } from '@/lib/flowvault-agent'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all open markets past their resolution time
  const { rows: markets } = await pool.query(`
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
      // Mark as resolving to prevent double-execution
      await pool.query(
        `UPDATE markets SET status = 'resolving' WHERE id = $1`,
        [market.id]
      )

      // Fetch current price
      const currentPrice = await getPrice(market.symbol)

      // Determine winner
      const condition = market.direction === 'above'
        ? currentPrice > parseFloat(market.target_value)
        : currentPrice < parseFloat(market.target_value)
      const winningSide = condition ? 'yes' : 'no'
      const losingSide = winningSide === 'yes' ? 'no' : 'yes'

      const totalPool = parseFloat(market.yes_pool) + parseFloat(market.no_pool)
      const winnerPool = parseFloat(market[`${winningSide}_pool`])
      const loserPool = parseFloat(market[`${losingSide}_pool`])

      // Get AI reasoning
      const reasoning = await getAgentReasoning({
        question: market.question,
        currentPrice,
        targetValue: parseFloat(market.target_value),
        direction: market.direction,
        winningSide
      })

      // Log to agent_log
      await pool.query(`
        INSERT INTO agent_log (market_id, action, price_at_resolution, reasoning)
        VALUES ($1, $2, $3, $4)
      `, [market.id, `RESOLVED_${winningSide.toUpperCase()}`, currentPrice, reasoning])

      let settleTxHash = null

      // Only execute settlement if there are funds in the pool
      if (totalPool > 0) {
        settleTxHash = await executeAtomicSettlement({
          totalPool,
          winnerPool,
          loserPool,
          winnerAddress: process.env.TREASURY_WALLET || ''
        })
      }

      // Update market as resolved
      await pool.query(`
        UPDATE markets SET
          status = 'resolved',
          winning_side = $1,
          resolution_price = $2,
          agent_reasoning = $3,
          settlement_tx_hash = $4
        WHERE id = $5
      `, [winningSide, currentPrice, reasoning, settleTxHash, market.id])

      // Calculate winner payout per staker
      if (loserPool > 0 && winnerPool > 0) {
        const { rows: winnerStakes } = await pool.query(
          `SELECT * FROM stakes WHERE market_id = $1 AND side = $2`,
          [market.id, winningSide]
        )

        for (const stake of winnerStakes) {
          const stakeAmount = parseFloat(stake.amount)
          const profit = (stakeAmount / winnerPool) * (loserPool * 0.95)
          const payout = stakeAmount + profit

          await pool.query(
            `UPDATE stakes SET payout_amount = $1, payout_tx_hash = $2 WHERE id = $3`,
            [payout, settleTxHash, stake.id]
          )
        }
      }

      // Send Telegram notification
      const explorerLink = settleTxHash
        ? `https://explorer.hiro.so/txid/${settleTxHash}?chain=testnet`
        : 'No funds staked'

      await sendTelegramMessage(
        `🏆 *MARKET RESOLVED*\n\n` +
        `"${market.question}"\n\n` +
        `*${winningSide.toUpperCase()} WINS*\n` +
        `Price at resolution: $${currentPrice}\n` +
        `Total pool: ${totalPool} USDCx\n\n` +
        `🤖 Agent: ${reasoning}\n\n` +
        `Settlement: [View Tx](${explorerLink})`
      )

      results.push({ marketId: market.id, winningSide, settleTxHash })

    } catch (error) {
      console.error(`Failed to resolve market ${market.id}:`, error)
      // Reset to open so it retries next cron
      await pool.query(
        `UPDATE markets SET status = 'open' WHERE id = $1`,
        [market.id]
      )
    }
  }

  return NextResponse.json({ resolved: results })
}
