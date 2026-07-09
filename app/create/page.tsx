'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateMarketPage() {
  const router = useRouter()
  const [walletAddress, setWalletAddress] = useState<string | null>(null)

  const [question, setQuestion] = useState('')
  const [symbol, setSymbol] = useState('STXUSDT')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [targetValue, setTargetValue] = useState('')
  const [durationMins, setDurationMins] = useState('15')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Read wallet from session (same as WalletConnect.tsx)
  useEffect(() => {
    import('@stacks/connect').then(({ AppConfig, UserSession }) => {
      try {
        const appConfig = new AppConfig(['store_write', 'publish_data'])
        const userSession = new UserSession({ appConfig })
        if (userSession.isUserSignedIn()) {
          const profile = userSession.loadUserData()
          const addr = profile.profile.stxAddress.testnet || profile.profile.stxAddress.mainnet
          setWalletAddress(addr)
        }
      } catch { /* not signed in */ }
    })
  }, [])

  // Fetch live price for reference
  useEffect(() => {
    fetch(`/api/price?symbol=${symbol}`)
      .then(res => res.json())
      .then(data => setCurrentPrice(data.price))
      .catch(() => {})
  }, [symbol])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!walletAddress) return setError('Connect wallet first')
    if (!question || !targetValue || !durationMins) return setError('Fill all fields')

    setLoading(true)
    setError('')

    const resolvesAt = new Date(Date.now() + parseInt(durationMins) * 60000).toISOString()

    try {
      const res = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          symbol,
          targetValue: parseFloat(targetValue),
          direction,
          marketType: 'flash',
          resolvesAt,
          createdBy: walletAddress
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create market')

      router.push(`/markets/${data.market.id}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  if (!walletAddress) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-xl mx-auto min-h-screen">
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold mb-4">Wallet Required</h2>
          <p className="text-gray-400 text-sm">Connect your Hiro Wallet using the button in the top nav to create a market.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 pb-20 px-6 max-w-2xl mx-auto min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl font-black mb-2">Create a Market</h1>
        <p className="text-gray-400">Set the asset, target price, and deadline. The AI handles resolution — automatically.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#121214] border border-white/5 rounded-2xl p-8 space-y-6">

        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">Market Question</label>
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Will STX be above $0.40 in 15 minutes?"
            className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-quorum-500/50"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">Asset Symbol</label>
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-quorum-500/50 appearance-none"
            >
              <option value="STXUSDT">STX (Stacks)</option>
              <option value="BTCUSDT">BTC (Bitcoin)</option>
              <option value="ETHUSDT">ETH (Ethereum)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">Direction</label>
            <div className="flex bg-[#0A0A0B] border border-white/10 rounded-xl p-1 h-[50px]">
              <button
                type="button"
                onClick={() => setDirection('above')}
                className={`flex-1 rounded-lg text-sm font-medium transition-colors ${direction === 'above' ? 'bg-quorum-500 text-[#0A0A0B]' : 'text-gray-400 hover:text-white'}`}
              >Above</button>
              <button
                type="button"
                onClick={() => setDirection('below')}
                className={`flex-1 rounded-lg text-sm font-medium transition-colors ${direction === 'below' ? 'bg-quorum-500 text-[#0A0A0B]' : 'text-gray-400 hover:text-white'}`}
              >Below</button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">Target Price</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              step="any"
              value={targetValue}
              onChange={e => setTargetValue(e.target.value)}
              placeholder={currentPrice ? `e.g. ${(currentPrice * 1.01).toFixed(4)}` : '0.00'}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-quorum-500/50"
            />
          </div>
          {currentPrice && (
            <p className="text-xs text-gray-500 mt-2">Current live price: ${currentPrice}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">Resolution Time</label>
          <select
            value={durationMins}
            onChange={e => setDurationMins(e.target.value)}
            className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-quorum-500/50 appearance-none"
          >
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
          </select>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-quorum-500 hover:bg-quorum-400 disabled:opacity-50 text-[#0A0A0B] font-bold rounded-xl transition-all"
        >
          {loading ? 'Creating Market...' : 'Create Flash Market'}
        </button>
      </form>
    </div>
  )
}
