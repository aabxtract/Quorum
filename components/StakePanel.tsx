'use client'
import { useState, useEffect } from 'react'

export default function StakePanel({ marketId, onStaked }: {
  marketId: string
  onStaked: () => void
}) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [side, setSide] = useState<'yes' | 'no'>('yes')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Read wallet address from session (same pattern as WalletConnect.tsx)
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
      } catch {
        // session not ready
      }
    })
  }, [])

  async function handleStake() {
    if (!walletAddress) return setError('Connect wallet first')
    if (!amount || parseFloat(amount) <= 0) return setError('Enter a valid amount')

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/markets/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          walletAddress,
          side,
          amount: parseFloat(amount),
          txHash: null // FlowVault tx initiated server-side on resolution
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record stake')

      setAmount('')
      onStaked()
    } catch (e: any) {
      setError(e.message || 'Failed to stake')
    } finally {
      setLoading(false)
    }
  }

  if (!walletAddress) {
    return (
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 text-center">
        <p className="text-gray-400 text-sm mb-2">Connect your Hiro wallet to stake</p>
        <p className="text-gray-600 text-xs">Use the Connect Wallet button in the nav</p>
      </div>
    )
  }

  return (
    <div className="bg-[#121214] border border-white/5 rounded-2xl p-6">
      <h3 className="text-white font-bold mb-5">Take a Position</h3>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setSide('yes')}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
            side === 'yes'
              ? 'bg-green-500 text-white'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          YES
        </button>
        <button
          onClick={() => setSide('no')}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
            side === 'no'
              ? 'bg-red-500 text-white'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
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
        className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-4 focus:outline-none focus:border-quorum-500/50"
      />

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      <button
        onClick={handleStake}
        disabled={loading}
        className="w-full bg-quorum-500 hover:bg-quorum-400 disabled:opacity-50 text-[#0A0A0B] font-bold py-3 rounded-xl text-sm transition-colors"
      >
        {loading ? 'Staking...' : `Stake ${side.toUpperCase()}${amount ? ` — ${amount} USDCx` : ''}`}
      </button>

      <p className="text-gray-600 text-xs text-center mt-4">
        No claiming needed · FlowVault auto-settles
      </p>
    </div>
  )
}
