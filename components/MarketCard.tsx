'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import PoolBar from './PoolBar'

export interface Market {
  id: string
  question: string
  yes_pool: string | number
  no_pool: string | number
  resolves_at: string
  status: string
  winning_side: string | null
  resolution_price: string | number | null
  agent_reasoning: string | null
  market_type: string
  symbol: string
  target_value: string | number
  direction: string
}

export default function MarketCard({ market }: { market: Market }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [expired, setExpired] = useState(false)

  const yesPool = parseFloat(market.yes_pool.toString())
  const noPool = parseFloat(market.no_pool.toString())
  const totalPool = yesPool + noPool

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const resolves = new Date(market.resolves_at)
      const diff = resolves.getTime() - now.getTime()

      if (diff <= 0) {
        setExpired(true)
        setTimeLeft('')
        return
      }

      setExpired(false)
      const hours = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${secs}s`)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [market.resolves_at])

  // Resolved
  if (market.status === 'resolved') {
    return (
      <Link href={`/markets/${market.id}`} className="block">
        <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6 h-full hover:border-[#4F6EF7]/50 transition-colors cursor-pointer">
          <p className="text-[#64748B] text-xs mb-2 uppercase tracking-wider font-mono">Resolved</p>
          <h3 className="text-white font-medium mb-4 line-clamp-2" title={market.question}>
            {market.question}
          </h3>
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-3 ${
            market.winning_side === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {market.winning_side?.toUpperCase()} WINS @ ${parseFloat(String(market.resolution_price)).toFixed(4)}
          </div>
          {market.agent_reasoning && (
            <p className="text-[#64748B] text-sm italic line-clamp-2">🤖 {market.agent_reasoning}</p>
          )}
        </div>
      </Link>
    )
  }

  // Closed (time up, pending agent resolution)
  if (expired || market.status === 'resolving') {
    return (
      <Link href={`/markets/${market.id}`} className="block">
        <div className="bg-[#13131A] border border-amber-500/20 rounded-xl p-6 h-full hover:border-amber-500/40 transition-colors cursor-pointer">
          <div className="flex justify-between items-start mb-4">
            <span className="text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
              {market.status === 'resolving' ? '⚙️ Resolving…' : '🔒 Closed'}
            </span>
            <span className="text-[#64748B] text-xs font-mono">
              {market.market_type === 'flash' ? '⚡ FLASH' : '📊 POSITION'}
            </span>
          </div>
          <h3 className="text-white font-medium mb-4 line-clamp-2" title={market.question}>
            {market.question}
          </h3>
          <PoolBar yesPool={yesPool} noPool={noPool} />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-[#64748B]">Total: {totalPool} USDCx</span>
            <span className="text-xs text-amber-400/70">Awaiting AI resolution</span>
          </div>
        </div>
      </Link>
    )
  }

  // Open
  return (
    <Link href={`/markets/${market.id}`} className="block">
      <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6 h-full hover:border-[#4F6EF7]/50 transition-colors cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[#4F6EF7] text-xs font-mono font-bold">
            {market.market_type === 'flash' ? '⚡ FLASH' : '📊 POSITION'}
          </span>
          <span className="text-[#64748B] text-xs font-mono">{timeLeft}</span>
        </div>
        <h3 className="text-white font-medium mb-4 line-clamp-2" title={market.question}>
          {market.question}
        </h3>
        <PoolBar yesPool={yesPool} noPool={noPool} />
        <div className="text-center text-xs text-[#64748B] mt-2">
          Total pool: {totalPool} USDCx
        </div>
      </div>
    </Link>
  )
}
