# Quorum — AI-Resolved Crypto Prediction Market

> *"Stake your conviction. The AI resolves it. FlowVault pays you automatically."*

Quorum is a permissionless crypto prediction market on Stacks where an AI agent (Llama 3.3 70b via Groq) resolves markets autonomously by reading public crypto APIs, and FlowVault settles proceeds atomically — no human oracles, no manual claiming, no operator discretion.

**Built for the FlowVault Builder Bounty — July 2026**

---

## The Problem

Crypto prediction markets today have three unsolved problems:

**Human oracles get gamed.** Polymarket uses UMA — humans vote on outcomes. It has failed multiple times. Insider trading, disputed resolutions, hundreds of thousands made on suspicious trades before announcements. The oracle is the weakest link.

**Winners have to manually claim.** You predicted correctly. Now find the claim button, pay gas, wait for confirmation. Every existing platform makes winners do extra work after being proven right.

**You trust the operator.** The platform controls your funds. The platform decides when you get paid. The platform can delay, skim, or shut down.

---

## The Solution

**Quorum replaces the oracle with an AI agent** that reads deterministic public crypto APIs — Binance, CoinGecko, Stacks API. Outcomes are numbers. Numbers cannot be disputed or manipulated.

**Quorum replaces manual claiming with FlowVault** — the moment the agent resolves a market, FlowVault atomically splits proceeds. Winners receive principal plus profit directly to their wallet. No action required.

**Quorum replaces operator trust with a contract** — FlowVault enforces every payout. Nobody — not the team, not the agent — can redirect or withhold funds once settlement fires.

---

## How It Works

**1. Stake**
User connects Hiro wallet, picks a market, chooses YES or NO, deposits USDCx. Funds go directly into the agent's FlowVault vault and are locked until market resolution. Transaction is signed by the user's browser wallet — Quorum never touches user keys.

**2. Agent Resolves**
At resolution time, a Vercel Cron job fires every minute, checks all markets past their deadline, fetches the resolution price from Binance public API, and determines the winning side. Llama 3.3 70b via Groq generates a public reasoning statement explaining the resolution — logged on-chain and broadcast to Telegram.

**3. FlowVault Pays**
Atomic settlement cycle executes immediately:
- `clearRoutingRules()` — wipe any stale routing config
- `setRoutingRules()` — configure winner split + protocol reserve lock
- `deposit()` — settlement fires, funds route automatically
- `clearRoutingRules()` — cycle reset for next market

Winners receive principal plus pro-rata profit share. Protocol takes 5% of loser pool, locked in FlowVault reserve. Losers' principal funds winner payouts. No claiming. No delays.

---

## Two Market Speeds

**⚡ Flash Markets**
Resolves in 5–60 minutes. Fast conviction plays on short-term price movements. Demo-friendly — watch a market resolve live in under 10 minutes.

**📊 Position Markets**
Resolves in hours to days. Strategic plays on longer-duration crypto outcomes. Pools grow over time — bigger loser pool means bigger winner profit.

---

## Settlement Logic — Principal Always Protected

```
WINNING TRADE:
Winner receives:  their_stake + (their_stake / winner_pool) * loser_pool * 0.95
Protocol receives: loser_pool * 0.05 (locked in FlowVault reserve)

LOSING TRADE:
Loser receives:   nothing (stake funds winner payouts)
Protocol receives: 0 if no profit was generated

EDGE CASE — all one side wins:
All stakers receive principal back
Protocol fee = 0 (no loser pool to take from)
```

The protocol only earns when there are losers. Principal is always returned to winners minimum.

---

## How FlowVault Is Used

Quorum uses all three FlowVault primitives on every market resolution:

**Hold**
Every user stake goes into a FlowVault Hold vault the moment they deposit. Funds are locked and untouchable — not by the user, not by the operator — until market resolution fires.

**Split**
On resolution, FlowVault Split routes 95% of the loser pool to the treasury wallet for winner distribution. The split amount is calculated fresh from live pool data before every settlement — never hardcoded, never stale.

**Lock**
5% of every loser pool is locked into a protocol reserve vault post-settlement. Funds are time-locked until `currentBlock + 1000` — enforced by the contract, not by application code.

---

## On-Chain Transaction Flow Per Market

Every market produces 7 verifiable on-chain transactions:

```
STAKING PHASE:
[tx 1] User wallet → FlowVault deposit (YES stake)
[tx 2] User wallet → FlowVault deposit (NO stake)

SETTLEMENT PHASE (atomic cycle):
[tx 3] Agent → clearRoutingRules()
[tx 4] Agent → setRoutingRules({ split, lock })
[tx 5] Agent → deposit() → FlowVault Split fires
[tx 6] Agent → clearRoutingRules()

PAYOUT PHASE:
[tx 7] Agent → USDCx transfer to winner wallet
```

All 7 transactions are visible on the Stacks testnet explorer with direct links provided in the app and Telegram.

---

## Bugs Found in FlowVault During Building

While integrating `flowvault-sdk@0.1.1` into Quorum, we identified three architectural limitations that directly impacted our design:

**Bug 1 — No memory across deposits**
The contract reapplies the same static routing rule to every deposit until explicitly changed. There is no per-deposit rule configuration. In a multi-user prediction market, a stale routing rule from a resolved market would corrupt the next settlement — routing wrong amounts to wrong addresses silently.

*How Quorum solves it:* Atomic rule-settlement cycles. Every resolution executes `clearRoutingRules → setRoutingRules → deposit → clearRoutingRules` as a single synchronous sequence. The agent wallet is the sole vault signer — no external deposit can fire between steps. Stale-rule corruption is architecturally impossible.

**Bug 2 — splitAmount is fixed, not percentage-based**
`splitAmount` accepts a fixed USDCx amount, not a proportion. There is no way to say "split 20% of this deposit." If the splitAmount exceeds the deposit, the entire transaction aborts. This makes proportional settlement impossible in a single call.

*How Quorum solves it:* The resolution function calculates exact split amounts from live pool data immediately before calling `setRoutingRules`. The amount is always computed fresh, always validated against the actual deposit before execution.

**Bug 3 — Single recipient per split**
The contract supports only one `splitAddress` per routing rule. Quorum cannot pay all winners in a single FlowVault transaction. Multi-winner distribution requires multiple sequential transfers.

*How Quorum solves it:* FlowVault routes settlement to the protocol treasury wallet. The agent then calculates each winner's pro-rata share and sends individual USDCx transfers via standard Stacks SIP-010 token transfers — separate from FlowVault but fully on-chain and verifiable.

---

## Telegram Integration

Quorum's Telegram channel functions as a live market trading floor — every market event broadcasts in real time to all subscribers.

**Bot:** `@QuorumVaultBot`
**Channel:** `Quorum Alerts`

### What Gets Broadcast

**New market open:**
```
🔔 NEW MARKET
"Will STX be above $0.40 in 10 minutes?"
⚡ Flash · Closes in 10 minutes
YES pool: 0 USDCx | NO pool: 0 USDCx
[Stake on Quorum →]
```

**Stake placed:**
```
💰 NEW STAKE
YES · 100 USDCx
"Will STX be above $0.40 in 10 minutes?"
YES pool: 100 USDCx | NO pool: 0 USDCx
```

**Market resolved:**
```
🏆 MARKET RESOLVED

"Will STX be above $0.40 in 10 minutes?"

YES WINS
Price at resolution: $0.42
Condition: above $0.40 ✓

🤖 Agent: "STX closed at $0.42 on Binance 
STXUSDT feed, above the $0.40 threshold. 
YES position wins."

171 USDCx distributed to 2 winners
Protocol reserve: 9 USDCx locked

Settlement: [View Tx →]
```

**Loss absorbed:**
```
⚠️ MARKET RESOLVED — NO WINS
"Will STX be above $0.50 in 10 minutes?"
Price: $0.42 · Condition not met

YES stakers: principal returned
NO stakers: profit distributed
[View Settlement →]
```

### Bot Commands

Users interact with the bot directly:

```
/markets   → list all active markets with pools and time remaining
/result    → last resolved market, winner, payout amount, tx hash
/join      → link to connect wallet and stake
```

### How It's Built

Single utility function — `lib/telegram.ts`:

```typescript
export async function sendTelegramMessage(text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    })
  })
}
```

Called from four places:
- `api/markets/create/route.ts` — on market creation
- `api/markets/stake/route.ts` — on every stake
- `api/agent/resolve/route.ts` — on every resolution
- Webhook `api/telegram/webhook/route.ts` — handles `/markets`, `/result`, `/join` commands

Bot webhook registered once after deploy:
```
https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://quorum.vercel.app/api/telegram/webhook
```

---

## Tech Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Frontend | Next.js 14 App Router + TypeScript | Web app |
| Styling | Tailwind CSS | UI |
| Wallet | `@stacks/connect` | Hiro/Leather wallet connection |
| On-chain settlement | `flowvault-sdk@0.1.1` | FlowVault vault interactions |
| Backend signer | `@stacks/transactions` | Agent wallet signs settlements |
| AI agent | `groq-sdk` — `llama-3.3-70b-versatile` | Market resolution + reasoning |
| Database | Neon Postgres (`pg`) | Markets, stakes, agent log |
| Cron | Vercel Cron Jobs | Resolution loop every 1 minute |
| Price feed | Binance public API | STX/USDT price at resolution |
| Notifications | Telegram Bot API | Live market alerts |
| Deployment | Vercel | Frontend + serverless functions |

---

## Contracts Used (Testnet)

```
FlowVault:  STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
USDCx:      ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
```

No custom contracts deployed. Quorum is built entirely on top of the existing FlowVault v2 contract.

---

## Testnet Transactions

| Action | Tx Hash | Explorer |
|--------|---------|---------|
| YES stake — demo market | [hash] | [link] |
| NO stake — demo market | [hash] | [link] |
| clearRoutingRules | [hash] | [link] |
| setRoutingRules | [hash] | [link] |
| FlowVault settlement deposit | [hash] | [link] |
| clearRoutingRules (reset) | [hash] | [link] |
| Winner payout transfer | [hash] | [link] |

---

## Resolution Sources

All resolution data comes from public APIs requiring no authentication:

| Source | Endpoint | Used For |
|--------|----------|---------|
| Binance | `api.binance.com/api/v3/ticker/price?symbol=STXUSDT` | STX, BTC, ETH price |
| CoinGecko | `api.coingecko.com/api/v3/simple/price` | Market caps, alt prices |
| Stacks API | `api.testnet.hiro.so/v2/info` | Block height, network stats |
| DefiLlama | `api.llama.fi/protocol/alex` | Protocol TVL |

All sources return deterministic numerical values. Outcomes are math — impossible to dispute or manipulate.

---

## Security Architecture

**Atomic Rule-Settlement Cycles**
The `flowvault-v2` contract has no memory across deposits — it reapplies the same routing rule to every deposit until changed. Quorum solves this with a mandatory 4-step atomic cycle on every resolution. The agent wallet is the sole vault signer. All four steps execute within a single synchronous Vercel function invocation. No external deposit can fire between steps. Stale-rule corruption is architecturally impossible.

**Agent wallet isolation**
The agent's private key is stored only in Vercel environment variables. It never appears in frontend code, never in logs, never in API responses. The agent wallet has one purpose: sign settlement transactions.

**Cron endpoint protection**
The `/api/agent/resolve` endpoint requires `Authorization: Bearer {CRON_SECRET}` on every request. Vercel sends this automatically on cron invocations. Direct HTTP calls without the secret return 401.

---

## Known Limitations

**Single-sided markets**
If all stakers pick the same side and that side wins, there is no loser pool to fund profit. Winners receive only their principal back. UI warns users when one side has zero stakes before they commit.

**Vercel Cron minimum interval**
Vercel free tier cron minimum is 1 minute. Flash markets cannot resolve in under 60 seconds. Minimum Flash Market duration is set to 5 minutes.

**Single split recipient**
FlowVault supports one `splitAddress` per routing rule. Multi-winner distribution happens via sequential USDCx transfers after the FlowVault settlement, not within FlowVault itself.

**Agent wallet as centralization point**
Settlement signing depends on one private key on Vercel. A compromised key could manipulate routing rules. Mitigation: atomic cycles minimize the window of vulnerability. Long-term fix: threshold signature scheme.

---

## Live Demo

**App:** [https://quorum.vercel.app]
**Telegram:** [t.me/QuorumAlerts]
**Demo Video:** [link]

---

## Local Development

```bash
git clone https://github.com/aabxtract/quorum
cd quorum
npm install
cp .env.example .env.local
# Fill in all env vars
npm run dev
```

```bash
# Seed demo market
npm run db:seed
```

---

## Environment Variables

```bash
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_FLOWVAULT_CONTRACT=STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
NEXT_PUBLIC_USDCX_CONTRACT=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
STACKS_PRIVATE_KEY=
STACKS_WALLET_ADDRESS=
TREASURY_WALLET=
DATABASE_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CRON_SECRET=
BINANCE_API=https://api.binance.com/api/v3
```

---

*Quorum — Stake your conviction. The agent resolves it. FlowVault pays.*

Built by @aabxtract · FlowVault Builder Bounty · July 2026
