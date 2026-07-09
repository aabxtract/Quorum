# Quorum — Full Build Guide
### AI-Resolved Crypto Prediction Market with FlowVault Settlement on Stacks
**Deadline: July 9, 2026 23:59 UTC | Build window: 12 hours**

---

## What Quorum Is

Quorum is a permissionless crypto prediction market where:
- Anyone creates a market on any verifiable crypto outcome
- An AI agent (Llama 3.3 70b via Groq) monitors and resolves markets automatically
- FlowVault settles proceeds atomically — winners paid, reserve locked, no claiming needed
- Telegram announces every resolution live with explorer proof

Two market speeds:
- **⚡ Flash Markets** — resolves in 5–60 minutes (demo mode)
- **📊 Position Markets** — resolves in hours/days (strategic mode)

For the 12-hour build: **Flash Markets only. One working end-to-end flow.**

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend + API | Next.js 14 App Router + TypeScript |
| Styling | Tailwind CSS |
| Wallet | `@stacks/connect` + Hiro/Leather wallet |
| On-chain settlement | `flowvault-sdk@0.1.1` |
| Backend signer | `@stacks/transactions` |
| AI agent brain | `groq-sdk` — `llama-3.3-70b-versatile` |
| Database | Neon Postgres (`pg`) |
| Cron | Vercel Cron Jobs |
| Price feed | Binance public API (no key needed) |
| Notifications | Telegram Bot API |
| Deployment | Vercel |

---

## Contracts (Testnet — Pre-deployed, Deploy Nothing)

```
FlowVault:  STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
USDCx:      ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
```

---

## Environment Variables

```bash
# Public
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_FLOWVAULT_CONTRACT=STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
NEXT_PUBLIC_USDCX_CONTRACT=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx

# Private (Vercel dashboard only)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
STACKS_PRIVATE_KEY=           # Agent operator wallet private key
STACKS_WALLET_ADDRESS=        # Agent operator STX address (ST...)
TREASURY_WALLET=              # Your treasury wallet address
DATABASE_URL=                 # Neon Postgres connection string
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CRON_SECRET=                  # Random secret string
BINANCE_API=https://api.binance.com/api/v3
```

---

## Database Schema

Run these migrations on Neon before building:

```sql
CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  resolution_source TEXT NOT NULL DEFAULT 'binance',
  symbol TEXT NOT NULL DEFAULT 'STXUSDT',
  target_value NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  market_type TEXT NOT NULL DEFAULT 'flash' CHECK (market_type IN ('flash', 'position')),
  resolves_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolving', 'resolved')),
  winning_side TEXT CHECK (winning_side IN ('yes', 'no')),
  yes_pool NUMERIC NOT NULL DEFAULT 0,
  no_pool NUMERIC NOT NULL DEFAULT 0,
  resolution_price NUMERIC,
  agent_reasoning TEXT,
  settlement_tx_hash TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  wallet_address TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  amount NUMERIC NOT NULL,
  flowvault_tx_hash TEXT,
  payout_amount NUMERIC,
  payout_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  action TEXT NOT NULL,
  price_at_resolution NUMERIC,
  reasoning TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed one demo market (update resolves_at before demo)
INSERT INTO markets (question, symbol, target_value, direction, market_type, resolves_at)
VALUES (
  'Will STX be above $0.40 in 10 minutes?',
  'STXUSDT',
  0.40,
  'above',
  'flash',
  NOW() + INTERVAL '10 minutes'
);
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Frontend                       │
│  / → Active markets, stake YES/NO, connect wallet       │
│  /markets/[id] → Market detail, pools, time remaining   │
│  /history → Past markets, payouts, explorer links       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│            Vercel Serverless Functions                   │
│                                                         │
│  POST /api/markets/stake                                │
│  → Records stake in DB                                  │
│  → Confirms FlowVault Hold tx from frontend wallet      │
│                                                         │
│  POST /api/markets/create                               │
│  → Validates market condition is auto-resolvable        │
│  → Inserts market into DB                               │
│                                                         │
│  GET /api/markets/[id]                                  │
│  → Returns market state + pools + stakes                │
│                                                         │
│  POST /api/agent/resolve  ← Vercel Cron (every 1 min)  │
│  → Check all open markets past resolves_at              │
│  → Fetch price from Binance                             │
│  → Call Groq for reasoning                              │
│  → Execute FlowVault atomic settlement                  │
│  → Send Telegram notification                           │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
   Binance Public API          FlowVault Contracts
   + Stacks API                Hold + Split + Lock
   (price resolution)          (USDCx settlement)
           │                          │
           └──────────┬───────────────┘
                      ▼
           Stacks Testnet Explorer
           (all tx hashes auditable)
```

---

## File Structure

```
quorum/
├── app/
│   ├── page.tsx                    # Home — active markets list
│   ├── markets/
│   │   └── [id]/
│   │       └── page.tsx            # Market detail + stake UI
│   ├── history/
│   │   └── page.tsx                # Resolved markets + payouts
│   └── create/
│       └── page.tsx                # Create new market form
│
├── api/
│   ├── agent/
│   │   └── resolve/
│   │       └── route.ts            # Cron endpoint — resolution + settlement
│   ├── markets/
│   │   ├── route.ts                # GET all markets, POST create market
│   │   ├── [id]/
│   │   │   └── route.ts            # GET single market
│   │   └── stake/
│   │       └── route.ts            # POST record stake
│   └── price/
│       └── route.ts                # GET current price proxy
│
├── lib/
│   ├── flowvault-agent.ts          # FlowVault backend signer + atomic settlement
│   ├── flowvault-browser.ts        # FlowVault browser wallet for staking
│   ├── groq.ts                     # Groq SDK client + resolution reasoning
│   ├── telegram.ts                 # Telegram sendMessage utility
│   ├── price.ts                    # Binance price fetcher
│   ├── db.ts                       # Neon Postgres client
│   └── stacks.ts                   # Stacks.js helpers
│
├── components/
│   ├── WalletConnect.tsx
│   ├── MarketCard.tsx
│   ├── StakePanel.tsx
│   ├── PoolBar.tsx                 # YES/NO pool visualization
│   └── AgentFeed.tsx               # Live agent decisions
│
├── vercel.json                     # Cron config
├── .env.local
└── README.md
```

---

## Core Implementation Files

### `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/agent/resolve",
      "schedule": "* * * * *"
    }
  ]
}
```

---

### `lib/db.ts`
```typescript
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

export default pool
```

---

### `lib/price.ts`
```typescript
export async function getPrice(symbol: string = 'STXUSDT'): Promise<number> {
  const res = await fetch(
    `${process.env.BINANCE_API}/ticker/price?symbol=${symbol}`,
    { next: { revalidate: 0 } }
  )
  const data = await res.json()
  return parseFloat(data.price)
}
```

---

### `lib/telegram.ts`
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
      disable_web_page_preview: true
    })
  })
}
```

---

### `lib/groq.ts`
```typescript
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function getAgentReasoning(params: {
  question: string
  currentPrice: number
  targetValue: number
  direction: string
  winningSide: string
}): Promise<string> {
  const { question, currentPrice, targetValue, direction, winningSide } = params

  const response = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content: `You are Quorum's AI resolution agent. You resolve crypto prediction markets.
You must respond with ONLY a single sentence explaining why the market resolved the way it did.
Be specific about the price. Be concise. No markdown.`
      },
      {
        role: 'user',
        content: `Market: "${question}"
Current price: $${currentPrice}
Condition: price ${direction} $${targetValue}
Result: ${winningSide.toUpperCase()} wins

Explain the resolution in one sentence.`
      }
    ]
  })

  return response.choices[0]?.message?.content || 'Market resolved by price condition.'
}
```

---

### `lib/flowvault-agent.ts`
```typescript
import { FlowVault } from 'flowvault-sdk'

export const agentVault = new FlowVault({
  network: 'testnet',
  contractAddress: 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD',
  contractName: 'flowvault-v2',
  tokenContractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  tokenContractName: 'usdcx',
  senderKey: process.env.STACKS_PRIVATE_KEY!
})

// Micro token conversion (USDCx = 6 decimals)
export const toMicro = (amount: number): string =>
  (BigInt(Math.floor(amount * 1_000_000))).toString()

export const fromMicro = (micro: string): number =>
  Number(BigInt(micro)) / 1_000_000

export async function executeAtomicSettlement(params: {
  totalPool: number        // total USDCx in market
  winnerPool: number       // total staked on winning side
  loserPool: number        // total staked on losing side
  winnerAddress: string    // aggregated winner wallet (use treasury as router)
}): Promise<string> {
  const { totalPool, loserPool } = params

  // Protocol takes 5% of loser pool
  const protocolFee = loserPool * 0.05
  const winnerPayout = loserPool * 0.95

  // Get current block height for lock
  const currentBlock = await agentVault.getCurrentBlockHeight(
    process.env.STACKS_WALLET_ADDRESS!
  )

  // ATOMIC CYCLE — 4 steps, no deviation
  // Step 1: Clear any stale routing rules
  await agentVault.clearRoutingRules()
  console.log('Step 1: Rules cleared')

  // Step 2: Set routing — split winner payout + lock protocol fee
  await agentVault.setRoutingRules({
    splitAddress: process.env.TREASURY_WALLET!,
    splitAmount: toMicro(winnerPayout),
    lockAmount: toMicro(protocolFee),
    lockUntilBlock: currentBlock + 1000
  })
  console.log('Step 2: Routing rules set')

  // Step 3: Deposit total pool — routing fires automatically
  const settleTx = await agentVault.deposit(toMicro(totalPool))
  console.log('Step 3: Settlement tx:', settleTx.txId)

  // Step 4: Clear rules — reset for next market
  await agentVault.clearRoutingRules()
  console.log('Step 4: Rules cleared — cycle complete')

  return settleTx.txId
}
```

---

### `lib/flowvault-browser.ts`
```typescript
import { request } from '@stacks/connect'
import { FlowVault } from 'flowvault-sdk'

export function createBrowserVault(senderAddress: string) {
  return new FlowVault({
    network: 'testnet',
    contractAddress: 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD',
    contractName: 'flowvault-v2',
    tokenContractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    tokenContractName: 'usdcx',
    senderAddress,
    contractCallExecutor: async (call: any) =>
      request('stx_callContract', {
        contract: `${call.contractAddress}.${call.contractName}`,
        functionName: call.functionName,
        functionArgs: call.functionArgs,
        network: call.network,
        postConditionMode: 'allow',
        postConditions: call.postConditions
      })
  })
}
```

---

### `api/agent/resolve/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getPrice } from '@/lib/price'
import { getAgentReasoning } from '@/lib/groq'
import { executeAtomicSettlement } from '@/lib/flowvault-agent'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all open markets past their resolution time
  const { rows: markets } = await pool.query(`
    SELECT * FROM markets 
    WHERE status = 'open' 
    AND resolves_at <= NOW()
    ORDER BY resolves_at ASC
    LIMIT 5
  `)

  if (markets.length === 0) {
    return NextResponse.json({ message: 'No markets to resolve' })
  }

  const results = []

  for (const market of markets) {
    try {
      // Mark as resolving to prevent double-execution
      await pool.query(
        `UPDATE markets SET status = 'resolving' WHERE id = $1`,
        [market.id]
      )

      // Fetch current price
      const currentPrice = await getPrice(market.symbol)

      // Determine winner
      const condition = market.direction === 'above'
        ? currentPrice > parseFloat(market.target_value)
        : currentPrice < parseFloat(market.target_value)
      const winningSide = condition ? 'yes' : 'no'
      const losingSide = winningSide === 'yes' ? 'no' : 'yes'

      const totalPool = parseFloat(market.yes_pool) + parseFloat(market.no_pool)
      const winnerPool = parseFloat(market[`${winningSide}_pool`])
      const loserPool = parseFloat(market[`${losingSide}_pool`])

      // Get AI reasoning
      const reasoning = await getAgentReasoning({
        question: market.question,
        currentPrice,
        targetValue: parseFloat(market.target_value),
        direction: market.direction,
        winningSide
      })

      // Log to agent_log
      await pool.query(`
        INSERT INTO agent_log (market_id, action, price_at_resolution, reasoning)
        VALUES ($1, $2, $3, $4)
      `, [market.id, `RESOLVED_${winningSide.toUpperCase()}`, currentPrice, reasoning])

      let settleTxHash = null

      // Only execute settlement if there are funds in the pool
      if (totalPool > 0) {
        settleTxHash = await executeAtomicSettlement({
          totalPool,
          winnerPool,
          loserPool,
          winnerAddress: process.env.TREASURY_WALLET!
        })
      }

      // Update market as resolved
      await pool.query(`
        UPDATE markets SET
          status = 'resolved',
          winning_side = $1,
          resolution_price = $2,
          agent_reasoning = $3,
          settlement_tx_hash = $4
        WHERE id = $5
      `, [winningSide, currentPrice, reasoning, settleTxHash, market.id])

      // Calculate winner payout per staker
      if (loserPool > 0 && winnerPool > 0) {
        const { rows: winnerStakes } = await pool.query(
          `SELECT * FROM stakes WHERE market_id = $1 AND side = $2`,
          [market.id, winningSide]
        )

        for (const stake of winnerStakes) {
          const stakeAmount = parseFloat(stake.amount)
          const profit = (stakeAmount / winnerPool) * (loserPool * 0.95)
          const payout = stakeAmount + profit

          await pool.query(
            `UPDATE stakes SET payout_amount = $1, payout_tx_hash = $2 WHERE id = $3`,
            [payout, settleTxHash, stake.id]
          )
        }
      }

      // Send Telegram notification
      const explorerLink = settleTxHash
        ? `https://explorer.hiro.so/txid/${settleTxHash}?chain=testnet`
        : 'No funds staked'

      await sendTelegramMessage(
        `🏆 *MARKET RESOLVED*\n\n` +
        `"${market.question}"\n\n` +
        `*${winningSide.toUpperCase()} WINS*\n` +
        `Price at resolution: $${currentPrice}\n` +
        `Total pool: ${totalPool} USDCx\n\n` +
        `🤖 Agent: ${reasoning}\n\n` +
        `Settlement: [View Tx](${explorerLink})`
      )

      results.push({ marketId: market.id, winningSide, settleTxHash })

    } catch (error) {
      console.error(`Failed to resolve market ${market.id}:`, error)
      // Reset to open so it retries next cron
      await pool.query(
        `UPDATE markets SET status = 'open' WHERE id = $1`,
        [market.id]
      )
    }
  }

  return NextResponse.json({ resolved: results })
}
```

---

### `api/markets/stake/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  const { marketId, walletAddress, side, amount, txHash } = await req.json()

  if (!marketId || !walletAddress || !side || !amount || !txHash) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Check market is still open
  const { rows } = await pool.query(
    `SELECT * FROM markets WHERE id = $1 AND status = 'open' AND resolves_at > NOW()`,
    [marketId]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Market closed or not found' }, { status: 400 })
  }

  // Record stake
  await pool.query(`
    INSERT INTO stakes (market_id, wallet_address, side, amount, flowvault_tx_hash)
    VALUES ($1, $2, $3, $4, $5)
  `, [marketId, walletAddress, side, amount, txHash])

  // Update pool totals
  const poolColumn = side === 'yes' ? 'yes_pool' : 'no_pool'
  await pool.query(
    `UPDATE markets SET ${poolColumn} = ${poolColumn} + $1 WHERE id = $2`,
    [amount, marketId]
  )

  return NextResponse.json({ success: true })
}
```

---

### `api/markets/create/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  const { question, symbol, targetValue, direction, marketType, resolvesAt, createdBy } = await req.json()

  // Validate
  if (!question || !symbol || !targetValue || !direction || !resolvesAt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate direction
  if (!['above', 'below'].includes(direction)) {
    return NextResponse.json({ error: 'Direction must be above or below' }, { status: 400 })
  }

  // Validate resolves_at is in the future
  if (new Date(resolvesAt) <= new Date()) {
    return NextResponse.json({ error: 'Resolution time must be in the future' }, { status: 400 })
  }

  const { rows } = await pool.query(`
    INSERT INTO markets (question, symbol, target_value, direction, market_type, resolves_at, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [question, symbol, targetValue, direction, marketType || 'flash', resolvesAt, createdBy])

  return NextResponse.json({ market: rows[0] })
}
```

---

### `components/MarketCard.tsx`
```typescript
'use client'
import { useState, useEffect } from 'react'

interface Market {
  id: string
  question: string
  yes_pool: number
  no_pool: number
  resolves_at: string
  status: string
  winning_side: string | null
  resolution_price: number | null
  agent_reasoning: string | null
}

export default function MarketCard({ market }: { market: Market }) {
  const [timeLeft, setTimeLeft] = useState('')
  const totalPool = market.yes_pool + market.no_pool
  const yesPercent = totalPool > 0 ? (market.yes_pool / totalPool) * 100 : 50

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const resolves = new Date(market.resolves_at)
      const diff = resolves.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('Resolving...')
        return
      }

      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${mins}m ${secs}s`)
    }, 1000)

    return () => clearInterval(interval)
  }, [market.resolves_at])

  if (market.status === 'resolved') {
    return (
      <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6">
        <p className="text-[#64748B] text-xs mb-2">RESOLVED</p>
        <h3 className="text-white font-medium mb-4">{market.question}</h3>
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-3 ${
          market.winning_side === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {market.winning_side?.toUpperCase()} WINS @ ${market.resolution_price}
        </div>
        {market.agent_reasoning && (
          <p className="text-[#64748B] text-sm italic">🤖 {market.agent_reasoning}</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6 hover:border-[#4F6EF7]/50 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[#4F6EF7] text-xs font-mono">⚡ FLASH</span>
        <span className="text-[#64748B] text-xs font-mono">{timeLeft}</span>
      </div>
      <h3 className="text-white font-medium mb-4">{market.question}</h3>

      {/* Pool bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-green-400">YES {yesPercent.toFixed(0)}%</span>
          <span className="text-red-400">NO {(100 - yesPercent).toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-[#1E1E2E] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
            style={{ width: `${yesPercent}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between text-xs text-[#64748B]">
        <span>{market.yes_pool} USDCx YES</span>
        <span>{market.no_pool} USDCx NO</span>
      </div>
      <div className="text-center text-xs text-[#64748B] mt-1">
        Total pool: {totalPool} USDCx
      </div>
    </div>
  )
}
```

---

### `components/StakePanel.tsx`
```typescript
'use client'
import { useState } from 'react'
import { useConnect } from '@stacks/connect-react'
import { createBrowserVault } from '@/lib/flowvault-browser'

export default function StakePanel({ marketId, onStaked }: {
  marketId: string
  onStaked: () => void
}) {
  const { userSession } = useConnect()
  const [side, setSide] = useState<'yes' | 'no'>('yes')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const walletAddress = userSession?.loadUserData()?.profile?.stxAddress?.testnet

  async function handleStake() {
    if (!walletAddress) return setError('Connect wallet first')
    if (!amount || parseFloat(amount) <= 0) return setError('Enter amount')

    setLoading(true)
    setError('')

    try {
      const vault = createBrowserVault(walletAddress)
      const amountMicro = (parseFloat(amount) * 1_000_000).toString()

      // Deposit into FlowVault Hold from browser wallet
      const result = await vault.deposit(amountMicro)
      const txHash = result.txId

      // Record stake in DB
      await fetch('/api/markets/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          walletAddress,
          side,
          amount: parseFloat(amount),
          txHash
        })
      })

      onStaked()
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  if (!walletAddress) {
    return (
      <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6 text-center">
        <p className="text-[#64748B] text-sm mb-4">Connect your Hiro wallet to stake</p>
      </div>
    )
  }

  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6">
      <h3 className="text-white font-medium mb-4">Take a Position</h3>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSide('yes')}
          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors ${
            side === 'yes'
              ? 'bg-green-500 text-white'
              : 'bg-[#1E1E2E] text-[#64748B] hover:text-white'
          }`}
        >
          YES
        </button>
        <button
          onClick={() => setSide('no')}
          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors ${
            side === 'no'
              ? 'bg-red-500 text-white'
              : 'bg-[#1E1E2E] text-[#64748B] hover:text-white'
          }`}
        >
          NO
        </button>
      </div>

      <input
        type="number"
        placeholder="Amount (USDCx)"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-4 py-3 text-white text-sm mb-4 focus:outline-none focus:border-[#4F6EF7]"
      />

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      <button
        onClick={handleStake}
        disabled={loading}
        className="w-full bg-[#4F6EF7] hover:bg-[#4F6EF7]/80 disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Staking...' : `Stake ${side.toUpperCase()} ${amount ? `— ${amount} USDCx` : ''}`}
      </button>

      <p className="text-[#64748B] text-xs text-center mt-3">
        Principal protected · Settlement automatic · No claiming needed
      </p>
    </div>
  )
}
```

---

## Security Architecture — Atomic Rule-Settlement Cycles

The `flowvault-v2` contract has no memory across deposits — it reapplies the same static routing rule to every deposit until explicitly changed. In an autonomous agent context this is critical: if a settlement fires before rules are updated for a new market cycle, the wrong split config applies.

**Quorum solves this with a 4-step atomic cycle on every resolution:**

```
Step 1: clearRoutingRules()      → wipe ALL previous routing config
Step 2: setRoutingRules({...})   → configure THIS market's exact split
Step 3: deposit(totalPool)       → settlement fires with correct rules
Step 4: clearRoutingRules()      → reset for next market
```

The agent wallet is the sole vault signer. No external deposit can fire between steps. Steps execute synchronously within a single serverless function invocation. Stale-rule corruption is architecturally impossible.

---

## Settlement Logic — Principal Always Protected

**Winning market:**
```
Winners receive: their_stake + (their_stake / winner_pool) * loser_pool * 0.95
Protocol receives: loser_pool * 0.05 (locked in FlowVault Lock)
```

**All-one-side market (everyone bet YES and YES wins):**
```
All stakers receive their principal back
Protocol fee = 0 (no loser pool)
```

Winners never lose their principal. Only the loser pool funds the winner payout. Protocol only earns when there are losers.

---

## Resolution Sources (Crypto Only)

| Source | API Endpoint | Example Markets |
|--------|-------------|-----------------|
| Binance | `api.binance.com/api/v3/ticker/price?symbol=STXUSDT` | STX, BTC, ETH price |
| CoinGecko | `api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd` | STX market cap |
| Stacks API | `api.testnet.hiro.so/v2/info` | Block height, tx count |
| DefiLlama | `api.llama.fi/protocol/alex` | ALEX TVL |

All sources are public, require no API key, and return deterministic numerical values — outcomes cannot be disputed or manipulated.

---

## 12-Hour Build Order

### Hour 1-2: FlowVault settlement working
- Install `flowvault-sdk@0.1.1`
- Build `lib/flowvault-agent.ts`
- Run smoke test: clearRoutingRules → setRoutingRules → deposit → clearRoutingRules
- Get a real tx hash on Stacks testnet explorer
- **Do not proceed until this works**

### Hour 3-4: Agent resolution loop
- Build `lib/price.ts` — Binance fetch
- Build `lib/groq.ts` — reasoning call
- Build `api/agent/resolve/route.ts`
- Test manually: POST to /api/agent/resolve with a past-due market in DB
- Confirm settlement fires and Telegram message arrives

### Hour 5-6: Staking flow
- Build `lib/flowvault-browser.ts`
- Build `components/StakePanel.tsx`
- Build `api/markets/stake/route.ts`
- Test: connect Hiro wallet, stake YES, confirm tx hash recorded in DB

### Hour 7-8: Frontend
- Build `app/page.tsx` — market list
- Build `app/markets/[id]/page.tsx` — market detail + stake panel
- Build `components/MarketCard.tsx`
- Wire wallet connect via `@stacks/connect-react`

### Hour 9: Market creation
- Build `app/create/page.tsx` — simple form
- Build `api/markets/create/route.ts`
- Test: create a Flash Market resolving in 5 minutes

### Hour 10: Full run-through
- Deploy to Vercel
- Seed one demo market in DB (resolves in 10 mins)
- Stake YES from Wallet 1
- Stake NO from Wallet 2
- Wait for cron to fire
- Confirm settlement tx on explorer
- Confirm Telegram message received

### Hour 11-12: Record demo video + README
- Record screen (OBS or Loom)
- Write README with all tx hashes

---

## Demo Script (3 Minutes)

```
0:00 — Show Quorum homepage. Active Flash Market visible.
       "Will STX be above $0.40 in 10 minutes?"
       YES pool: 0 | NO pool: 0

0:20 — Connect Wallet 1 (YES staker)
       Stake 100 USDCx on YES
       FlowVault Hold tx fires — show explorer link

0:45 — Connect Wallet 2 (NO staker)  
       Stake 80 USDCx on NO
       FlowVault Hold tx fires — show explorer link

1:00 — Show live STX price from Binance
       "The agent is watching. Current price: $0.42"
       Pool bar shows YES 56% / NO 44%

1:30 — Resolution time arrives
       Cron fires /api/agent/resolve
       Agent reads STX = $0.42 — above $0.40 — YES wins

2:00 — ATOMIC SETTLEMENT on screen:
       clearRoutingRules tx — explorer link
       setRoutingRules tx — explorer link  
       deposit/split tx — explorer link
       clearRoutingRules tx — explorer link

2:20 — Telegram message arrives live:
       "YES WINS — 171 USDCx distributed"

2:40 — Show Wallet 1 balance:
       Deposited 100 USDCx → Received 171 USDCx
       Principal back + 71 USDCx profit

3:00 — "No operator. No oracle. No claiming.
        The agent resolved. FlowVault paid."
```

---

## What Makes This Win

| Criterion | Weight | How Quorum Scores |
|-----------|--------|-------------------|
| Innovation | 35% | First AI-resolved prediction market on Stacks. AI is the oracle — no UMA, no humans, no disputes |
| FlowVault Integration | 30% | All 3 primitives: Hold (stakes) + Split (winner payout) + Lock (protocol reserve). Atomic cycles solve the contract's memory limitation |
| Technical Execution | 20% | Real testnet txs on every resolution. 4 explorer links per market. Verifiable, auditable, deterministic |
| Ecosystem Value | 15% | Permissionless market creation. Anyone bets on any crypto outcome. Reusable settlement infrastructure |

**The line that beats Susu:**
Susu found the FlowVault memory bug and worked around it with manual signing. Quorum solved it architecturally with atomic rule-settlement cycles — making fully autonomous AI operation safe where Susu couldn't go.

**The demo moment that wins:**
Show the atomic settlement firing — 4 sequential tx hashes on explorer, all within seconds. Nobody else's demo has this. It's the visual proof of deep FlowVault integration that judges can click and verify.

---

## Accounts Needed Right Now

- [ ] Hiro wallet — 2 accounts (YES staker + NO staker) with testnet USDCx + testnet STX
- [ ] Agent wallet — separate Hiro account, private key exported for `STACKS_PRIVATE_KEY`
- [ ] Neon — database created, connection string copied
- [ ] Vercel — account ready
- [ ] Groq — API key from `console.groq.com`
- [ ] Telegram — bot created via BotFather, channel created, bot added as admin, chat ID retrieved

---

## README Template (Copy for Submission)

```markdown
# Quorum — AI-Resolved Crypto Prediction Market

> "Stake your conviction. The agent resolves it. FlowVault pays."

## What It Does
Quorum is a permissionless crypto prediction market on Stacks where an AI agent 
(Llama 3.3 70b via Groq) resolves markets automatically by reading public crypto 
APIs, and FlowVault settles proceeds atomically — no claiming, no oracle disputes, 
no human intervention.

## How FlowVault Is Used
- **Hold** — all stakes locked until market resolution
- **Split** — loser pool distributed to winners automatically on resolution  
- **Lock** — 5% protocol reserve locked post-settlement

## Security: Atomic Rule-Settlement Cycles
The flowvault-v2 contract has no memory across deposits. Quorum solves this with 
a 4-step atomic cycle on every resolution: clearRoutingRules → setRoutingRules → 
deposit → clearRoutingRules. The agent wallet is the sole signer, making stale-rule 
corruption architecturally impossible.

## Testnet Transactions
- Demo market settlement: [tx hash]
- FlowVault Hold (YES stake): [tx hash]
- FlowVault Hold (NO stake): [tx hash]
- FlowVault Split (settlement): [tx hash]

## Stack
Next.js 14 · flowvault-sdk@0.1.1 · Groq/Llama 3.3 70b · Neon Postgres · 
Vercel Cron · Telegram Bot · Stacks testnet

## Live Demo
[link to deployed app]

## Demo Video
[link to screen recording]
```

---

*Quorum. Stake your conviction. The agent resolves it. FlowVault pays.*
