'use client'
import useSWR from 'swr'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function HistoryPage() {
  const { data, error } = useSWR('/api/markets', fetcher)

  if (error) return <div className="p-20 text-center text-red-400">Failed to load history</div>
  if (!data) return <div className="p-20 text-center text-gray-400 animate-pulse">Loading history...</div>

  const resolvedMarkets = data.markets?.filter((m: any) => m.status === 'resolved') || []

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl font-black font-heading mb-2">Resolved Markets</h1>
        <p className="text-gray-400">Every outcome, verified on-chain. The AI called it — FlowVault paid it out.</p>
      </div>

      {resolvedMarkets.length === 0 ? (
        <div className="p-20 text-center bg-[#13131A] border border-[#1E1E2E] rounded-2xl text-gray-400">
          No resolved markets yet.
        </div>
      ) : (
        <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#0A0A0F] text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Market</th>
                  <th className="px-6 py-4 font-medium">Result</th>
                  <th className="px-6 py-4 font-medium">Pool Size</th>
                  <th className="px-6 py-4 font-medium">Resolution Price</th>
                  <th className="px-6 py-4 font-medium">Settlement Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E2E]">
                {resolvedMarkets.map((market: any) => (
                  <tr key={market.id} className="hover:bg-[#1a1a24] transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/markets/${market.id}`} className="text-white hover:text-[#4F6EF7] font-medium block max-w-xs truncate" title={market.question}>
                        {market.question}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        market.winning_side === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {market.winning_side?.toUpperCase()} WINS
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {parseFloat(market.yes_pool) + parseFloat(market.no_pool)} USDCx
                    </td>
                    <td className="px-6 py-4 text-gray-300 font-mono">
                      ${market.resolution_price}
                    </td>
                    <td className="px-6 py-4">
                      {market.settlement_tx_hash ? (
                        <a 
                          href={`https://explorer.hiro.so/txid/${market.settlement_tx_hash}?chain=testnet`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[#4F6EF7] hover:underline flex items-center gap-1"
                        >
                          View ↗
                        </a>
                      ) : (
                        <span className="text-gray-500">No funds</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
