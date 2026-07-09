import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Diagnostic endpoint — checks env vars, fetches recent Telegram updates to
// find your chat_id, and optionally sends a test message.
//
// GET  /api/telegram/debug          — show config + recent updates (find chat_id here)
// POST /api/telegram/debug          — send a test message to TELEGRAM_CHAT_ID

export async function GET() {
  const token   = process.env.TELEGRAM_BOT_TOKEN
  const chatId  = process.env.TELEGRAM_CHAT_ID

  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set in env' }, { status: 500 })
  }

  // Pull the last 5 updates so the user can find their chat_id
  const res  = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5&offset=-5`)
  const data = await res.json()

  const chats = (data.result || []).map((u: any) => ({
    update_id: u.update_id,
    chat_id:   u.message?.chat?.id,
    from:      u.message?.from?.username,
    text:      u.message?.text,
  }))

  return NextResponse.json({
    token_set:    true,
    chat_id_set:  !!chatId,
    chat_id:      chatId || '(not set — copy one of the chat_ids below)',
    recent_chats: chats,
    instructions: chatId
      ? 'TELEGRAM_CHAT_ID is set. POST this endpoint to send a test message.'
      : 'Set TELEGRAM_CHAT_ID in Vercel env vars to the chat_id shown above, then redeploy.',
  })
}

export async function POST(req: NextRequest) {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token)  return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  if (!chatId) return NextResponse.json({ error: 'TELEGRAM_CHAT_ID not set — GET this endpoint first to find it' }, { status: 500 })

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    chatId,
      text:       '✅ *Quorum Telegram connected!*\n\nThis is a test message from your Vercel deployment.',
      parse_mode: 'Markdown',
    }),
  })

  const data = await res.json()
  return NextResponse.json({ ok: res.ok, telegram_response: data })
}
