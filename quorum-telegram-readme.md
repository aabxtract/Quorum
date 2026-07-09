# Quorum — Telegram Bot Integration

Real-time trade alerts and vault status for followers, pushed directly to Telegram whenever the agent acts.

---

## Setup (5 minutes)

### 1. Create the bot
1. Open Telegram → search `@BotFather`
2. Send `/newbot`
3. Name it: `Quorum Vault`
4. Username: `@QuorumVaultBot` (or whatever is available)
5. Copy the **Bot Token** BotFather gives you

### 2. Create your announcements channel
1. Create a new Telegram channel — name it `Quorum Alerts`
2. Add `@QuorumVaultBot` as an **administrator**
3. Get the **Chat ID**:
   - Send any message to the channel
   - Visit: `https://api.telegram.org/bot{YOUR_TOKEN}/getUpdates`
   - Copy the `chat.id` value from the response (it will be negative, e.g. `-1001234567890`)

### 3. Add env vars to Vercel
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=-1001234567890
```

---

## The Utility Function

`lib/telegram.ts`
```typescript
export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  })
}
```

No library needed. One function, called everywhere.

---

## Where to Call It

### On agent decision (`api/agent/loop.ts`)
```typescript
await sendTelegramMessage(
  `🤖 *Quorum Agent Decision*\n` +
  `Action: ${decision.action}\n` +
  `Price: $${currentPrice}\n` +
  `Reasoning: ${decision.reasoning}`
)
```

### On trade open (`api/trade/open.ts`)
```typescript
await sendTelegramMessage(
  `🟢 *Position Opened*\n` +
  `Pair: STX/xUSD\n` +
  `Entry: $${entryPrice}\n` +
  `Size: ${positionSize} USDCx\n` +
  `Tx: [View on Explorer](https://explorer.hiro.so/txid/${txHash}?chain=testnet)`
)
```

### On trade close + settlement (`api/trade/close.ts`)
```typescript
await sendTelegramMessage(
  `${pnl >= 0 ? '🔴' : '✅'} *Position Closed*\n` +
  `Exit: $${exitPrice}\n` +
  `PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%\n` +
  `Follower split: ${followerShare} USDCx settled\n` +
  `Reserve locked: ${reserveShare} USDCx\n` +
  `Settlement Tx: [View](https://explorer.hiro.so/txid/${settleTxHash}?chain=testnet)`
)
```

### On stop-loss hit (`api/trade/close.ts`)
```typescript
await sendTelegramMessage(
  `⚠️ *Stop-Loss Hit*\n` +
  `Loss absorbed by reserve vault.\n` +
  `Your principal is intact.\n` +
  `Reserve Tx: [View](https://explorer.hiro.so/txid/${lockTxHash}?chain=testnet)`
)
```

---

## Bot Commands (Optional)

Set up slash commands via BotFather (`/setcommands`) so followers can query the vault:

```
status - Current vault AUM, open position, reserve size
log - Last 5 agent decisions with reasoning
join - Get the deposit link
```

Handle them in a webhook endpoint `api/telegram/webhook.ts`:
```typescript
export async function POST(req: Request) {
  const { message } = await req.json()
  const command = message?.text

  if (command === '/status') {
    const vault = await getVaultState() // your existing DB query
    await sendTelegramMessage(
      `📊 *Quorum Vault Status*\n` +
      `AUM: ${vault.aum} USDCx\n` +
      `Open position: ${vault.openPosition ? 'Yes' : 'None'}\n` +
      `Reserve locked: ${vault.reserveAmount} USDCx\n` +
      `Followers: ${vault.followerCount}`
    )
  }

  if (command === '/log') {
    const decisions = await getLastDecisions(5) // last 5 from agent_decisions table
    const log = decisions.map((d, i) =>
      `${i + 1}. ${d.action} @ $${d.price_at_decision}\n_${d.reasoning}_`
    ).join('\n\n')
    await sendTelegramMessage(`🤖 *Last 5 Agent Decisions*\n\n${log}`)
  }

  if (command === '/join') {
    await sendTelegramMessage(
      `🔗 *Join Quorum*\n` +
      `Deposit USDCx and let the agent trade for you.\n` +
      `[Open Quorum](https://quorum.vercel.app/deposit)`
    )
  }

  return Response.json({ ok: true })
}
```

Register the webhook once after deploy:
```
https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://quorum.vercel.app/api/telegram/webhook
```

---

## What Followers See in the Channel

```
🟢 Position Opened
Pair: STX/xUSD
Entry: $0.42
Size: 3,000 USDCx
Tx: View on Explorer

🤖 Quorum Agent Decision
Action: HOLD
Price: $0.43
Reasoning: Price moved 2.3% but momentum 
indicators are flat. Holding position 
until clearer signal.

✅ Position Closed
Exit: $0.45
PnL: +7.1%
Follower split: 2,100 USDCx settled
Reserve locked: 300 USDCx
Settlement Tx: View
```

---

*One utility function. Zero extra infrastructure. Followers stay informed without refreshing the app.*
