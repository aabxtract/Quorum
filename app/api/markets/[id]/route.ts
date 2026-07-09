import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { rows: marketRows } = await getPool().query(
      `SELECT * FROM markets WHERE id = $1`,
      [id]
    )

    if (marketRows.length === 0) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    const { rows: stakeRows } = await getPool().query(
      `SELECT * FROM stakes WHERE market_id = $1 ORDER BY created_at DESC`,
      [id]
    )

    return NextResponse.json({
      market: marketRows[0],
      stakes: stakeRows
    })
  } catch (error) {
    console.error('Error fetching market:', error)
    return NextResponse.json({ error: 'Failed to fetch market' }, { status: 500 })
  }
}
