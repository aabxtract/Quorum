import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { createMarketOnChain } from '@/lib/quorum-agent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { rows } = await getPool().query(`
      SELECT * FROM markets
      ORDER BY created_at DESC
    `)
    return NextResponse.json({ markets: rows })
  } catch (error) {
    console.error('Error fetching markets:', error)
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { question, symbol, targetValue, direction, marketType, resolvesAt, createdBy } = await req.json()

    if (!question || !symbol || !targetValue || !direction || !resolvesAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['above', 'below'].includes(direction)) {
      return NextResponse.json({ error: 'Direction must be above or below' }, { status: 400 })
    }

    if (new Date(resolvesAt) <= new Date()) {
      return NextResponse.json({ error: 'Resolution time must be in the future' }, { status: 400 })
    }

    const { rows } = await getPool().query(`
      INSERT INTO markets (question, symbol, target_value, direction, market_type, resolves_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [question, symbol, targetValue, direction, marketType || 'flash', resolvesAt, createdBy])

    const created = rows[0]

    // Register the market on-chain (fire-and-forget; log errors but don't fail the request)
    createMarketOnChain(created.id).catch((err) => {
      console.error(`[quorum] create-market on-chain failed for ${created.id}:`, err)
    })

    sendTelegramMessage(
      `🆕 *NEW MARKET*\n\n` +
        `"${created.question}"\n\n` +
        `${created.symbol} ${created.direction} $${created.target_value}\n` +
        `Resolves: ${new Date(created.resolves_at).toISOString().replace('T', ' ').slice(0, 16)} UTC`
    ).catch(() => {})

    return NextResponse.json({ market: created })
  } catch (error) {
    console.error('Error creating market:', error)
    return NextResponse.json({ error: 'Failed to create market' }, { status: 500 })
  }
}
