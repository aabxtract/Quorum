'use client'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import StakePanel from '@/components/StakePanel'
import PoolBar from '@/components/PoolBar'
import { useEffect, useState } from 'react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function MarketDetailPage() {
  const params = useParams()
  const { data, error, mutate } = useSWR(`/api/markets/${params.id}`, fetcher, { refreshInterval: 5000 })
  const [timeLeft, setTimeLeft] = useState('')

  const market = data?.market
  const stakes = data?.stakes || []

  const isExpired = market && new Date(market.resolves_at) <= new Date() && market.status !== 'resolved'
  const isClosed = isExpired || market?.status === 'resolving'

  // Client-side nudge: when a user opens an expired-but-unresolved market,
  // ping the public nudge endpoint so it doesn't have to wait for the next cron tick.
  useEffect(() => {
    if (!isExpired || market?.status === 'resolving') return
    fetch('/api/agent/nudge', { method: 'POST' }).catch(() => {})
  }, [isExpired, market?.status])

  useEffect(() => {
    if (!market) return
    const tick = () => {
      const now = new Date()
      const resolves = new Date(market.resolves_at)
      const diff = resolves.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('')
        return
      }

      const hours = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [market])

  if (error) return <div className="p-20 text-center text-red-400">Failed to load market</div>
  if (!market) return <div className="p-20 text-center text-gray-400 animate-pulse">Loading market...</div>

  const yesPool = parseFloat(market.yes_pool)
  const noPool = parseFloat(market.no_pool)
  const totalPool = yesPool + noPool

  return (
    <div className="pt-24 pb-20 px-6 max-w-5xl mx-auto min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-8">
            <div className="flex flex-wrap gap-3 items-center mb-6">
              <span className="text-[#4F6EF7] text-sm font-mono font-bold bg-[#4F6EF7]/10 px-3 py-1 rounded">
                {market.market_type === 'flash' ? '⚡ FLASH' : '📊 POSITION'}
              </span>
              <span className="text-gray-400 text-sm font-mono bg-[#1E1E2E] px-3 py-1 rounded">
                Target: ${market.target_value} ({market.direction})
              </span>
              <span className="text-gray-400 text-sm font-mono bg-[#1E1E2E] px-3 py-1 rounded">
                Pair: {market.symbol}
              </span>
              {market.status === 'open' && !isClosed && timeLeft && (
                <span className="text-white text-sm font-mono bg-[#1E1E2E] px-3 py-1 rounded ml-auto">
                  Resolves in: {timeLeft}
                </span>
              )}
              {isClosed && market.status !== 'resolved' && (
                <span className="text-amber-400 text-sm font-mono bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded ml-auto">
                  {market.status === 'resolving' ? '⚙️ Agent resolving…' : '🔒 Closed · Awaiting AI'}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-black font-heading mb-4">{market.question}</h1>

            {/* Plain-English condition explanation */}
            <div className="flex gap-3 mb-6 text-sm">
              <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                <span className="text-green-400 font-bold">YES wins if</span>
                <span className="text-gray-300 ml-2">
                  {market.symbol.replace('USDT', '')} price is{' '}
                  <span className="font-mono font-bold">
                    {market.direction === 'above' ? '>' : '<'} ${parseFloat(market.target_value).toFixed(4)}
                  </span>{' '}
                  at resolution
                </span>
              </div>
              <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <span className="text-red-400 font-bold">NO wins if</span>
                <span className="text-gray-300 ml-2">
                  {market.symbol.replace('USDT', '')} price is{' '}
                  <span className="font-mono font-bold">
                    {market.direction === 'above' ? '≤' : '≥'} ${parseFloat(market.target_value).toFixed(4)}
                  </span>{' '}
                  at resolution
                </span>
              </div>
            </div>

            <PoolBar yesPool={yesPool} noPool={noPool} />
            <div className="text-center text-sm text-[#64748B] mt-2">
              Total pool: {totalPool} USDCx
            </div>
          </div>

          {/* Resolution Info (if resolved) */}
          {market.status === 'resolved' && (
            <div className="bg-gradient-to-r from-[#13131A] to-[#1a1a24] border border-[#1E1E2E] rounded-2xl p-8 animate-fade-in-up">
              <h2 className="text-xl font-bold font-heading mb-6">Resolution Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E]">
                  <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Winner</p>
                  <p className={`text-xl font-bold ${market.winning_side === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                    {market.winning_side?.toUpperCase()}
                  </p>
                </div>
                <div className="p-4 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E]">
                  <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Resolution Price</p>
                  <p className="text-xl font-bold text-white">
                    ${parseFloat(market.resolution_price).toFixed(4)}
                  </p>
                </div>
                <div className="p-4 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E]">
                  <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Settlement</p>
                  {market.settlement_tx_hash ? (
                    <a href={`https://explorer.hiro.so/txid/${market.settlement_tx_hash}?chain=testnet`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4F6EF7] hover:underline flex items-center gap-1 mt-1">
                      View Tx ↗
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1">No funds staked</p>
                  )}
                </div>
              </div>
              
              <div className="bg-[#0A0A0F] p-5 rounded-xl border border-[#1E1E2E]">
                <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">AI Reasoning</p>
                <p className="text-white italic">🤖 "{market.agent_reasoning}"</p>
              </div>
            </div>
          )}

          {/* Stakes Table */}
          {stakes.length > 0 && (
            <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-[#1E1E2E]">
                <h3 className="text-lg font-bold font-heading">Stakers</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#0A0A0F] text-gray-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Wallet</th>
                      <th className="px-6 py-4 font-medium">Side</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      {market.status === 'resolved' && <th className="px-6 py-4 font-medium">Payout</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E1E2E]">
                    {stakes.map((stake: any) => (
                      <tr key={stake.id} className="hover:bg-[#1a1a24] transition-colors">
                        <td className="px-6 py-4 font-mono text-gray-300">
                          {stake.wallet_address.slice(0, 6)}...{stake.wallet_address.slice(-4)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            stake.side === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {stake.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white font-medium">
                          {stake.amount} USDCx
                        </td>
                        {market.status === 'resolved' && (
                          <td className="px-6 py-4 text-white font-medium">
                            {stake.payout_amount ? `${parseFloat(stake.payout_amount).toFixed(2)} USDCx` : '-'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            {market.status === 'open' && !isClosed ? (
              <StakePanel marketId={market.id} onStaked={() => mutate()} />
            ) : market.status === 'resolved' ? (
              <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6 text-center">
                <h3 className="text-white font-bold mb-2">Market Resolved</h3>
                <p className="text-gray-400 text-sm">Settlement complete. Winners have been paid out.</p>
              </div>
            ) : (
              <div className="bg-[#13131A] border border-amber-500/20 rounded-xl p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center mx-auto text-xl">⚙️</div>
                <h3 className="text-white font-bold">Awaiting Agent Resolution</h3>
                <p className="text-gray-400 text-sm">
                  Time is up. The AI agent will resolve this market automatically within a few minutes.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-400 text-xs font-mono">Agent checking every 2 min</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
