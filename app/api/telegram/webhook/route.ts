import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'

// Register once after deploy:
// https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://<host>/api/telegram/webhook

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()
    const message = update?.message
    const chatId = message?.chat?.id
    const text: string = (message?.text || '').trim()

    if (!chatId || !text) return NextResponse.json({ ok: true })

    const cmd = text.split(/\s+/)[0].toLowerCase()

    if (cmd === '/start' || cmd === '/help') {
      await sendTelegramMessage(
        `👋 *Welcome to Quorum*\n\n` +
          `Prediction markets, resolved by AI, settled by FlowVault.\n\n` +
          `*Commands*\n` +
          `/status — live vault + market snapshot\n` +
          `/log — last 5 agent resolutions\n` +
          `/markets — open flash markets right now\n` +
          `/join — get started`,
        chatId
      )
    } else if (cmd === '/status') {
      const [{ rows: openM }, { rows: resolvedM }, { rows: stakeAgg }] = await Promise.all([
        getPool().query(`SELECT COUNT(*)::int AS c FROM markets WHERE status='open'`),
        getPool().query(`SELECT COUNT(*)::int AS c FROM markets WHERE status='resolved'`),
        getPool().query(
          `SELECT COALESCE(SUM(amount),0)::float AS total,
                  COUNT(*)::int AS c
             FROM stakes`
        ),
      ])
      await sendTelegramMessage(
        `📊 *Quorum Status*\n\n` +
          `Open markets: *${openM[0].c}*\n` +
          `Resolved: *${resolvedM[0].c}*\n` +
          `Total stakes recorded: *${stakeAgg[0].c}* (${stakeAgg[0].total.toFixed(2)} USDCx)`,
        chatId
      )
    } else if (cmd === '/log') {
      const { rows } = await getPool().query(
        `SELECT question, winning_side, resolution_price, agent_reasoning
           FROM markets
          WHERE status='resolved'
          ORDER BY created_at DESC
          LIMIT 5`
      )
      if (rows.length === 0) {
        await sendTelegramMessage('No markets have resolved yet.', chatId)
      } else {
        const body = rows
          .map(
            (r, i) =>
              `*${i + 1}.* ${r.question}\n` +
              `→ ${String(r.winning_side).toUpperCase()} wins @ $${r.resolution_price}\n` +
              `_${r.agent_reasoning ?? '—'}_`
          )
          .join('\n\n')
        await sendTelegramMessage(`🤖 *Recent Resolutions*\n\n${body}`, chatId)
      }
    } else if (cmd === '/markets') {
      const { rows } = await getPool().query(
        `SELECT question, symbol, target_value, direction, resolves_at
           FROM markets
          WHERE status='open' AND resolves_at > NOW()
          ORDER BY resolves_at ASC
          LIMIT 5`
      )
      if (rows.length === 0) {
        await sendTelegramMessage('No open markets right now.', chatId)
      } else {
        const body = rows
          .map(
            (r, i) =>
              `*${i + 1}.* ${r.question}\n` +
              `${r.symbol} ${r.direction} $${r.target_value} · ` +
              `resolves ${new Date(r.resolves_at).toISOString().replace('T', ' ').slice(0, 16)} UTC`
          )
          .join('\n\n')
        await sendTelegramMessage(`⚡ *Open Markets*\n\n${body}`, chatId)
      }
    } else if (cmd === '/join') {
      const url = process.env.NEXT_PUBLIC_APP_URL || 'https://quorum.vercel.app'
      await sendTelegramMessage(
        `🔗 *Join Quorum*\n\nStake on outcomes, AI resolves them, FlowVault settles atomically.\n\n[Open Quorum](${url})`,
        chatId
      )
    } else if (cmd.startsWith('/')) {
      await sendTelegramMessage(
        `Unknown command. Try /help.`,
        chatId
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[telegram webhook] error:', err)
    // Always ACK — Telegram retries on non-200, and we don't want retry loops.
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    note: 'POST-only. Register with Telegram via setWebhook.',
  })
}
