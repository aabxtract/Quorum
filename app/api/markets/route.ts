import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'

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

    // Validate
    if (!question || !symbol || !targetValue || !direction || !resolvesAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate direction
    if (!['above', 'below'].includes(direction)) {
      return NextResponse.json({ error: 'Direction must be above or below' }, { status: 400 })
    }

    // Validate resolves_at is in the future
    if (new Date(resolvesAt) <= new Date()) {
      return NextResponse.json({ error: 'Resolution time must be in the future' }, { status: 400 })
    }

    const { rows } = await getPool().query(`
      INSERT INTO markets (question, symbol, target_value, direction, market_type, resolves_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [question, symbol, targetValue, direction, marketType || 'flash', resolvesAt, createdBy])

    const created = rows[0]
    // Fire-and-forget Telegram announcement
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
