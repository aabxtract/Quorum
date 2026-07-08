# Syndicate

**AI-Operated Copy Trading with Trust-Enforced Settlement on Stacks**

> *"The fund that can't lie to you."*

## What It Is

Syndicate is a copy trading platform where an **AI agent acts as the fund operator** — it watches the STX/xUSD market on ALEX DEX testnet, makes autonomous trade decisions, executes real swaps on-chain, and automatically settles proceeds to followers via FlowVault (Split + Lock + Hold) — no human in the loop.

Followers deposit USDCx into a Hold vault, the AI trades, and when a position closes, FlowVault automatically splits proceeds: **70% to followers pro-rata, 20% to protocol treasury, 10% into a locked loss-reserve.**

Every decision the AI makes is logged with its reasoning, visible to all followers.

## Tech Stack

| Layer | Tools |
|-------|-------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Stacks.js, SWR, Recharts |
| **Backend** | Vercel Serverless Functions, Groq SDK (Llama 3.3 70b), `@stacks/transactions` |
| **Database** | Neon (Postgres) via Drizzle ORM |
| **Blockchain** | ALEX DEX testnet, FlowVault v2, Stacks testnet |
| **Cron** | Vercel Cron Jobs (every 5 minutes) |

## How It Works

1. **AI Agent Loop** (every 5 min):
   - Fetch STX/xUSD price from ALEX API
   - Get last 10 price readings for trend analysis
   - Send to Llama 3.3 70b via Groq API
   - Agent decides: OPEN, CLOSE, or HOLD with reasoning
   - Execute swap on ALEX DEX testnet if OPEN/CLOSE

2. **On Settlement (CLOSE)**:
   - Calculate P&L
   - FlowVault Split: 70% followers, 20% treasury, 10% reserve
   - Lock reserve for ~2000 blocks

3. **Followers**:
   - Connect Hiro/Leather wallet
   - Deposit USDCx into Hold vault
   - Track portfolio value in real time
   - Withdraw when no position is open

## Project Structure

```
syndicate/
├── app/
│   ├── page.tsx                    # Vault overview
│   ├── deposit/page.tsx            # Deposit USDCx
│   ├── portfolio/page.tsx          # Follower portfolio
│   ├── agent-log/page.tsx          # Full decision history
│   ├── api/
│   │   ├── agent/loop/route.ts     # AI decision loop (cron)
│   │   ├── trade/open/route.ts     # Manual open trigger
│   │   ├── trade/close/route.ts    # Manual close trigger
│   │   ├── vault/state/route.ts    # Vault state API
│   │   ├── vault/settle/route.ts   # Settlement trigger
│   │   ├── follower/register/route.ts
│   │   └── follower/balance/route.ts
│   └── layout.tsx
├── components/
│   ├── WalletConnect.tsx
│   ├── VaultStats.tsx
│   ├── AgentDecisionFeed.tsx
│   └── SettlementHistory.tsx
├── lib/
│   ├── db.ts                       # Drizzle schema + queries
│   ├── groq.ts                     # Groq AI agent client
│   ├── alex.ts                     # ALEX DEX swap calls
│   ├── flowvault.ts                # FlowVault SDK wrapper
│   └── stacks.ts                   # Stacks helpers
├── vercel.json                     # Cron job config
├── drizzle.config.ts               # DB migration config
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 18+
- Hiro Wallet (2 accounts: operator + follower)
- Testnet STX funded: https://explorer.hiro.so/sandbox/faucet?chain=testnet
- Groq API key: https://console.groq.com
- Neon Postgres database: https://neon.tech
- Vercel account for deployment

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Key vars:
- `GROQ_API_KEY` — Your Groq API key
- `STACKS_PRIVATE_KEY` — Agent operator wallet private key
- `DATABASE_URL` — Neon connection string
- `CRON_SECRET` — Random secret for cron security

### Install & Run

```bash
npm install
npm run dev
```

### Database Migrations

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Deploy to Vercel

```bash
npx vercel --prod
```

Set all environment variables in Vercel Dashboard. The cron job in `vercel.json` will activate automatically.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vault/state` | GET | Vault AUM, position, decisions, settlements |
| `/api/price` | GET | Current STX/xUSD price + history |
| `/api/agent/loop` | GET | AI decision loop (cron only, auth required) |
| `/api/trade/open` | POST | Manual open position |
| `/api/trade/close` | POST | Manual close position |
| `/api/vault/settle` | POST | Manual settlement trigger |
| `/api/follower/register` | POST | Register follower deposit |
| `/api/follower/balance` | GET | Follower portfolio data |

## Smart Contracts (Testnet)

| Contract | Address |
|----------|---------|
| FlowVault | `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2` |
| ALEX Swap | `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.swap-helper-v1-03` |
| USDCx | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` |

## License

MIT
