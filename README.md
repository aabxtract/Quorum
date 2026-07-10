# Quorum

**AI-Resolved Prediction Markets with On-Chain Settlement on Stacks**

> *"Predict the price. Get paid instantly."*

## What It Is

Quorum is a prediction market platform where markets expire and resolve automatically — no manual claiming, no delays, no trust required.

An **AI agent** monitors market deadlines, fetches live prices from CoinMarketCap, checks the condition against the market definition, and declares a winner. **FlowVault**, a smart contract on Stacks, escrows every stake and distributes winnings atomically the moment the AI resolves — funds go straight to winners' wallets.

### Mobile-First Alerts via Telegram

Get real-time market alerts directly on your phone via the **Quorum Alerts** Telegram bot — no need to be glued to a browser.

- Instant notifications when new markets are created
- Resolution alerts with payout confirmations
- Telegram-first: all critical updates arrive on mobile

Join: [t.me/quorumalerts](https://t.me/quorumalerts)

## How It Works

1. **Create or pick a market** — Set a condition, a deadline, and two possible outcomes (YES/NO).
2. **Stake through your wallet** — Connect Hiro/Leather Wallet, deposit USDCx into the market. FlowVault holds every stake in escrow.
3. **AI resolves at expiry** — The resolution agent fetches the live price, determines the outcome, and declares a winner on-chain.
4. **Payouts arrive automatically** — FlowVault distributes winnings to winning wallets in a single atomic transaction. No manual claim step.

## Tech Stack

| Layer | Tools |
|-------|-------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, SWR |
| **Backend** | Vercel Serverless Functions, Groq SDK (Llama 3.3 70b) |
| **Database** | Neon (Postgres) via Drizzle ORM |
| **Blockchain** | Stacks testnet, FlowVault v2, USDCx |
| **Cron** | Vercel Cron Jobs for market resolution & payout retries |
| **Alerts** | Telegram bot (`@quorumalerts`) — mobile-first notifications |

## Features

- **Flash Markets** — Resolve in 5–60 minutes. Built for quick price-move trades.
- **Position Markets** — Run for hours or days. For macro conviction trades.
- **AI Resolution** — Autonomous agent checks live price data, resolves markets within seconds of expiry.
- **FlowVault Settlement** — Every stake held on-chain. Winnings distributed atomically at resolution. No manual claiming.
- **Telegram Alerts** — Mobile-first notifications for market creation, resolution, and payouts.
- **Live Agent Feed** — See every decision the AI makes with full reasoning.
- **Retry Payouts** — Failed payouts are automatically retried.

## Project Structure

```
quorum/
├── app/
│   ├── page.tsx                    # Home page (hero, markets, FAQ)
│   ├── markets/page.tsx            # Market listing
│   ├── markets/[id]/page.tsx       # Market detail + stake panel
│   ├── create/page.tsx             # Create new market
│   ├── history/page.tsx            # Stake & payout history
│   ├── account/page.tsx            # User account
│   ├── auth/page.tsx               # Wallet auth
│   ├── api/
│   │   ├── markets/                # Market CRUD + stake + resolve
│   │   ├── agent/                  # AI resolution + payout
│   │   └── user/                   # User data
│   └── layout.tsx
├── components/
│   ├── StakePanel.tsx              # Stake UI with wallet signing
│   ├── MarketCard.tsx              # Market card component
│   ├── AgentFeed.tsx               # AI agent decision feed
│   └── WalletContext.tsx           # Wallet connection
├── contracts/
│   └── quorum-market.clar          # On-chain market registry
├── lib/
│   ├── flowvault-agent.ts          # Server-side FlowVault agent
│   ├── flowvault-browser.ts        # Browser wallet FlowVault calls
│   ├── flowvault-config.ts         # Contract wiring config
│   ├── quorum-agent.ts             # Quorum contract helpers
│   ├── groq.ts                     # Groq AI agent client
│   └── db.ts                       # Drizzle schema + queries
├── tests/
│   ├── quorum-market.test.ts       # Contract unit tests (25/25 pass)
│   └── live-integration.mjs        # Live testnet integration tests
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 18+
- Hiro Wallet or Leather Wallet
- Testnet STX funded: https://explorer.hiro.so/sandbox/faucet?chain=testnet
- Testnet USDCx from the FlowVault faucet
- Groq API key: https://console.groq.com
- Neon Postgres database: https://neon.tech
- Vercel account for deployment

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Key vars:
- `GROQ_API_KEY` — Your Groq API key
- `STACKS_PRIVATE_KEY` — Agent wallet private key
- `DATABASE_URL` — Neon connection string
- `NEXT_PUBLIC_AGENT_WALLET_ADDRESS` — Agent Stacks address
- `NEXT_PUBLIC_QUORUM_CONTRACT` — Deployed market contract
- `CRON_SECRET` — Random secret for cron security
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for alerts
- `TELEGRAM_CHAT_ID` — Telegram chat ID for alerts

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

## Smart Contracts (Testnet)

| Contract | Address |
|----------|---------|
| Quorum Market Registry | `ST2K5BNBN6BSF3S4EQ0EFRMM4MD4JTGKF0PY90E70.quorum-market` |
| FlowVault | `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2` |
| USDCx | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` |

## Telegram Alerts

Stay updated on the go: [t.me/quorumalerts](https://t.me/quorumalerts)

The Telegram bot delivers:
- New market creation alerts
- Market resolution notifications with winner announcements
- Payout confirmation messages
- System health and error alerts

Mobile-first design — everything reaches your phone so you never miss a trade or payout.

## License

MIT
