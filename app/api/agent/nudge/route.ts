import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public endpoint — no secret required.
// Checks whether any markets actually need resolving before forwarding
// to the internal resolve logic, so browser calls can't abuse it.
export async function POST() {
  try {
    const { rows } = await getPool().query(`
      SELECT COUNT(*)::int AS count
      FROM markets
      WHERE status = 'open'
        AND resolves_at <= NOW()
    `)

    const pending = rows[0]?.count ?? 0

    if (pending === 0) {
      return NextResponse.json({ ok: true, message: 'No markets pending resolution' })
    }

    // Forward to the authenticated resolve endpoint server-side
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const res = await fetch(`${base}/api/agent/resolve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: true, pending, resolved: data })
  } catch (err: any) {
    console.error('[nudge] error:', err)
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
