import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { comparePassword, signJwt } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password, walletAddress } = await req.json()

    const client = await getPool().connect()
    try {
      let user: Record<string, unknown> | null = null

      if (walletAddress) {
        // Wallet login — match by wallet_address
        const result = await client.query(
          `SELECT id, email, wallet_address, display_name, avatar_url
           FROM users WHERE wallet_address = $1`,
          [walletAddress]
        )
        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'No account found for this wallet. Please sign up first.' },
            { status: 404 }
          )
        }
        user = result.rows[0]
      } else {
        // Email + password login
        if (!email || !password) {
          return NextResponse.json(
            { error: 'Email and password are required' },
            { status: 400 }
          )
        }

        const result = await client.query(
          `SELECT id, email, wallet_address, display_name, avatar_url, password_hash
           FROM users WHERE email = $1`,
          [email.toLowerCase()]
        )

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          )
        }

        const row = result.rows[0]
        if (!row.password_hash) {
          return NextResponse.json(
            { error: 'This account uses wallet login. Please connect your wallet.' },
            { status: 401 }
          )
        }

        const valid = await comparePassword(password, row.password_hash)
        if (!valid) {
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          )
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password_hash: _ph, ...rest } = row
        user = rest
      }

      if (!user) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }

      // Update last_login_at
      await client.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      )

      const token = await signJwt({
        sub: user.id as string,
        email: user.email as string,
        walletAddress: (user.wallet_address as string) || undefined,
        displayName: (user.display_name as string) || undefined,
      })

      const response = NextResponse.json({ user })
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      return response
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
