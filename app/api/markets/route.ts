import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { rows } = await pool.query(`
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

    const { rows } = await pool.query(`
      INSERT INTO markets (question, symbol, target_value, direction, market_type, resolves_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [question, symbol, targetValue, direction, marketType || 'flash', resolvesAt, createdBy])

    return NextResponse.json({ market: rows[0] })
  } catch (error) {
    console.error('Error creating market:', error)
    return NextResponse.json({ error: 'Failed to create market' }, { status: 500 })
  }
}
