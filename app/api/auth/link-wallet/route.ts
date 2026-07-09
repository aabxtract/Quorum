import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { verifyJwt, signJwt } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get('auth_token')?.value
    const headerToken = req.headers.get('authorization')?.replace('Bearer ', '')
    const token = cookieToken || headerToken

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = await verifyJwt(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { walletAddress } = await req.json()
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 })
    }

    // Stacks addresses are 40 chars, testnet prefix ST, mainnet SP/SM
    const addr = walletAddress.trim()
    if (!/^S[PMTN][0-9A-Z]{38,42}$/i.test(addr)) {
      return NextResponse.json({ error: 'Invalid Stacks address' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      // Already linked to *this* user? No-op success.
      const current = await client.query(
        `SELECT id, email, wallet_address, display_name FROM users WHERE id = $1`,
        [payload.sub]
      )
      if (current.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const user = current.rows[0]

      if (user.wallet_address === addr) {
        return NextResponse.json({ user })
      }

      if (user.wallet_address && user.wallet_address !== addr) {
        return NextResponse.json(
          { error: 'A different wallet is already linked. Contact support to change it.' },
          { status: 409 }
        )
      }

      // Wallet already in use by someone else?
      const taken = await client.query(
        `SELECT id FROM users WHERE wallet_address = $1 AND id <> $2`,
        [addr, payload.sub]
      )
      if (taken.rows.length > 0) {
        return NextResponse.json(
          { error: 'This wallet is already linked to another account' },
          { status: 409 }
        )
      }

      const updated = await client.query(
        `UPDATE users SET wallet_address = $1
           WHERE id = $2
       RETURNING id, email, wallet_address, display_name, avatar_url, created_at, last_login_at`,
        [addr, payload.sub]
      )
      const newUser = updated.rows[0]

      // Reissue JWT so it carries the wallet address
      const newToken = await signJwt({
        sub: newUser.id,
        email: newUser.email,
        walletAddress: newUser.wallet_address || undefined,
        displayName: newUser.display_name || undefined,
      })

      const res = NextResponse.json({ user: newUser })
      res.cookies.set('auth_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      return res
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Link wallet error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
