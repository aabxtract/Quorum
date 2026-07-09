import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { verifyJwt } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    // Try cookie first, then Authorization header
    const cookieToken = req.cookies.get('auth_token')?.value
    const headerToken = req.headers.get('authorization')?.replace('Bearer ', '')
    const token = cookieToken || headerToken

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const payload = await verifyJwt(token)
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const client = await getPool().connect()
    try {
      const userResult = await client.query(
        `SELECT id, email, wallet_address, display_name, avatar_url, created_at, last_login_at
         FROM users WHERE id = $1`,
        [payload.sub]
      )

      if (userResult.rows.length === 0) {
        return NextResponse.json({ user: null }, { status: 401 })
      }

      const user = userResult.rows[0]

      // Fetch stake history with market details (matched by wallet_address)
      let stakes: any[] = []
      if (user.wallet_address) {
        const stakesResult = await client.query(
          `SELECT
             s.id,
             s.side,
             s.amount,
             s.payout_amount,
             s.tx_hash,
             s.created_at,
             m.id   AS market_id,
             m.question,
             m.symbol,
             m.status AS market_status,
             m.winning_side,
             m.resolution_price
           FROM stakes s
           JOIN markets m ON s.market_id = m.id
           WHERE s.wallet_address = $1
           ORDER BY s.created_at DESC`,
          [user.wallet_address]
        )
        stakes = stakesResult.rows
      }

      return NextResponse.json({
        user,
        stakes,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Me error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
