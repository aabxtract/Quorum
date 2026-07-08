'use client'
import useSWR from 'swr'
import MarketCard, { Market } from '@/components/MarketCard'
import { useState } from 'react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function MarketsPage() {
  const { data, error } = useSWR('/api/markets', fetcher, { refreshInterval: 10000 })
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open')

  const markets = data?.markets || []
  
  const filteredMarkets = markets.filter((m: Market) => {
    if (filter === 'all') return true
    return m.status === filter
  })

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black font-heading mb-2">Markets</h1>
          <p className="text-gray-400">Stake on outcomes, settled by AI.</p>
        </div>
        
        <div className="flex bg-[#13131A] border border-[#1E1E2E] rounded-xl p-1 w-fit">
          <button 
            onClick={() => setFilter('open')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'open' ? 'bg-[#4F6EF7] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Open
          </button>
          <button 
            onClick={() => setFilter('resolved')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'resolved' ? 'bg-[#4F6EF7] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Resolved
          </button>
          <button 
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-[#4F6EF7] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-12 text-center bg-[#13131A] rounded-2xl border border-red-500/20 text-red-400">Failed to load markets</div>
      ) : !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-56 bg-[#13131A] border border-[#1E1E2E] rounded-xl animate-pulse"></div>
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
