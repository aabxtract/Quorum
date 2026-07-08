import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { hashPassword, signJwt } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password, walletAddress } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Email+password signup requires a password
    if (!walletAddress && !password) {
      return NextResponse.json(
        { error: 'Password is required for email signup' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    try {
      // Check for existing email
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      )
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        )
      }

      // Check for existing wallet
      if (walletAddress) {
        const existingWallet = await client.query(
          'SELECT id FROM users WHERE wallet_address = $1',
          [walletAddress]
        )
        if (existingWallet.rows.length > 0) {
          return NextResponse.json(
            { error: 'This wallet is already linked to an account' },
            { status: 409 }
          )
        }
      }

      const passwordHash = password ? await hashPassword(password) : null

      const result = await client.query(
        `INSERT INTO users (email, password_hash, wallet_address, last_login_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, email, wallet_address, display_name, avatar_url, created_at`,
        [email.toLowerCase(), passwordHash, walletAddress || null]
      )

      const user = result.rows[0]
      const token = await signJwt({
        sub: user.id,
        email: user.email,
        walletAddress: user.wallet_address || undefined,
        displayName: user.display_name || undefined,
      })

      const response = NextResponse.json({ user }, { status: 201 })
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
      return response
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
