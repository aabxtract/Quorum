'use client'
import useSWR from 'swr'
import MarketCard, { Market } from '@/components/MarketCard'
import { useState } from 'react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

type Filter = 'open' | 'closed' | 'resolved' | 'all'

function PriceTicker({ symbol, label }: { symbol: string; label: string }) {
  const { data, error } = useSWR(
    `/api/price?symbol=${symbol}`,
    fetcher,
    { refreshInterval: 15000 }
  )
  const price: number | undefined = data?.price
  const displayPrice =
    price === undefined
      ? '—'
      : price >= 100
        ? price.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : price.toFixed(4)

  return (
    <div className="flex-1 md:flex-none min-w-[140px] bg-[#13131A] border border-[#1E1E2E] rounded-xl px-4 py-3 flex items-center gap-3">
      <span className="text-gray-500 text-xs uppercase tracking-widest font-mono">{label}</span>
      <span className={`ml-auto font-mono font-bold text-sm ${error ? 'text-red-400' : data ? 'text-white' : 'text-gray-500 animate-pulse'}`}>
        {error ? 'err' : `$${displayPrice}`}
      </span>
      {data && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="Live" />
      )}
    </div>
  )
}

function isExpired(market: Market) {
  return new Date(market.resolves_at) <= new Date() && market.status !== 'resolved'
}

export default function MarketsPage() {
  const { data, error } = useSWR('/api/markets', fetcher, { refreshInterval: 10000 })
  const [filter, setFilter] = useState<Filter>('open')

  const markets: Market[] = data?.markets || []

  const counts = {
    open: markets.filter(m => m.status === 'open' && !isExpired(m)).length,
    closed: markets.filter(m => isExpired(m)).length,
    resolved: markets.filter(m => m.status === 'resolved').length,
    all: markets.length,
  }

  const filteredMarkets = markets.filter(m => {
    if (filter === 'all') return true
    if (filter === 'open') return m.status === 'open' && !isExpired(m)
    if (filter === 'closed') return isExpired(m)
    if (filter === 'resolved') return m.status === 'resolved'
    return true
  })

  const tabs: { key: Filter; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-6">
        <div>
          <h1 className="text-4xl font-black font-heading mb-2">Markets</h1>
          <p className="text-gray-400">Stake on outcomes, settled by AI.</p>
        </div>

        <div className="flex bg-[#13131A] border border-[#1E1E2E] rounded-xl p-1 w-fit">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filter === key ? 'bg-[#4F6EF7] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                  filter === key ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Live price ticker */}
      <div className="flex flex-wrap gap-3 mb-10">
        <PriceTicker symbol="STXUSDT" label="STX" />
        <PriceTicker symbol="BTCUSDT" label="BTC" />
        <PriceTicker symbol="ETHUSDT" label="ETH" />
      </div>

      {error ? (
        <div className="p-12 text-center bg-[#13131A] rounded-2xl border border-red-500/20 text-red-400">
          Failed to load markets
        </div>
      ) : !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-56 bg-[#13131A] border border-[#1E1E2E] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="p-20 text-center bg-[#13131A] border border-[#1E1E2E] rounded-2xl">
          <p className="text-gray-400 text-lg mb-2">No {filter} markets found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map((market: Market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  )
}
