export async function sendTelegramMessage(
  text: string,
  chatIdOverride?: string | number
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = chatIdOverride ?? process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn('[telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID')
    return
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[telegram] API error ${res.status}: ${body}`)
    }
  } catch (err) {
    console.error('[telegram] Failed to send message:', err)
  }
}
