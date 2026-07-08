'use client'
import useSWR from 'swr'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function AgentFeed() {
  const { data, error } = useSWR('/api/markets', fetcher, { refreshInterval: 15000 })

  if (error) return <div className="text-sm text-red-400 p-4 border border-red-500/20 rounded-xl bg-red-500/5">Failed to load feed</div>
  if (!data) return <div className="text-sm text-[#64748B] animate-pulse">Loading agent decisions...</div>

  // Filter only resolved markets, limit to 5
  const resolvedMarkets = data.markets?.filter((m: any) => m.status === 'resolved').slice(0, 5) || []

  if (resolvedMarkets.length === 0) {
    return <div className="text-sm text-[#64748B] p-4 bg-[#13131A] rounded-xl border border-[#1E1E2E]">Waiting for first resolution...</div>
  }

  return (
    <div className="space-y-4">
      {resolvedMarkets.map((market: any) => (
        <div key={market.id} className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-4">
          <div className="flex justify-between items-start mb-2">
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              market.winning_side === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {market.winning_side?.toUpperCase()} WINS
            </span>
            <Link href={`/markets/${market.id}`} className="text-xs text-[#4F6EF7] hover:underline">
              View
            </Link>
          </div>
          <p className="text-white text-sm font-medium mb-2">{market.question}</p>
          <div className="bg-[#0A0A0F] p-3 rounded-lg text-xs text-[#64748B] italic mb-2 border border-[#1E1E2E]">
            🤖 {market.agent_reasoning}
          </div>
          {market.settlement_tx_hash && (
            <a 
              href={`https://explorer.hiro.so/txid/${market.settlement_tx_hash}?chain=testnet`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              Settlement Tx
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
