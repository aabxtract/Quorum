'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@/lib/wallet-context'
import { stakeOnMarket } from '@/lib/flowvault-browser'

const toMicro = (amount: number): string =>
  BigInt(Math.floor(amount * 1_000_000)).toString()

interface StakeRow {
  wallet_address: string
  side: 'yes' | 'no'
}

export default function StakePanel({ marketId, stakes = [], onStaked }: {
  marketId: string
  stakes?: StakeRow[]
  onStaked: () => void
}) {
  const { walletAddress, walletLoading, connectWallet } = useWallet()

  // Which sides has this wallet already used?
  const myStakes = walletAddress
    ? stakes.filter((s) => s.wallet_address === walletAddress)
    : []
  const stakedYes = myStakes.some((s) => s.side === 'yes')
  const stakedNo  = myStakes.some((s) => s.side === 'no')
  const bothUsed  = stakedYes && stakedNo

  // Default the side selector to whichever side is still available.
  const defaultSide: 'yes' | 'no' = stakedYes && !stakedNo ? 'no' : 'yes'
  const [side, setSide] = useState<'yes' | 'no'>(defaultSide)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleStake() {
    if (!walletAddress) {
      await connectWallet()
      return
    }
    if ((side === 'yes' && stakedYes) || (side === 'no' && stakedNo)) {
      return setError(`You've already staked ${side.toUpperCase()} on this market.`)
    }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return setError('Enter a valid amount')

    setLoading(true)
    setError('')
    setTxHash(null)

    try {
      // 1. Set split routing → deposit → clear (Hiro popups x3)
      //    The split routes the stake to the agent wallet automatically.
      setStatus('Requesting wallet signatures (3 approvals)…')
      const { depositTxId } = await stakeOnMarket(walletAddress, toMicro(amt))
      setTxHash(depositTxId)

      // 2. Record the stake in Postgres + trigger on-chain registry update
      setStatus('Recording stake…')
      const res = await fetch('/api/markets/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          walletAddress,
          side,
          amount: amt,
          txHash: depositTxId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record stake')

      setStatus('Stake confirmed!')
      setAmount('')
      onStaked()
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (/user (rejected|denied|cancel)/i.test(msg)) {
        setError('Signature cancelled')
      } else {
        setError(msg || 'Failed to stake')
      }
    } finally {
      setLoading(false)
    }
  }

  if (walletLoading) {
    return (
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 space-y-4 animate-pulse">
        <div className="h-5 w-32 bg-white/5 rounded" />
        <div className="flex gap-2">
          <div className="flex-1 h-12 bg-white/5 rounded-xl" />
          <div className="flex-1 h-12 bg-white/5 rounded-xl" />
        </div>
        <div className="h-12 bg-white/5 rounded-xl" />
        <div className="h-12 bg-white/5 rounded-xl" />
      </div>
    )
  }

  if (!walletAddress) {
    return (
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 text-center space-y-4">
        <p className="text-gray-300 font-medium">No wallet linked to your account</p>
        <p className="text-gray-500 text-xs">
          Link your Leather / Hiro wallet on your account page so staking works automatically here.
        </p>
        <Link
          href="/account"
          className="block w-full bg-quorum-500 hover:bg-quorum-400 text-[#0A0A0B] font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Go to Account → Link Wallet
        </Link>
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 border-t border-white/5" />
          <span className="text-gray-600 text-[10px] uppercase tracking-widest">or</span>
          <div className="flex-1 border-t border-white/5" />
        </div>
        <button
          onClick={connectWallet}
          className="w-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
        >
          Connect wallet just for this session
        </button>
      </div>
    )
  }

  if (bothUsed) {
    return (
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 text-center space-y-3">
        <h3 className="text-white font-bold">You're all in</h3>
        <p className="text-gray-400 text-sm">
          You've staked both YES and NO on this market. Top-ups aren't supported yet — wait for resolution.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#121214] border border-white/5 rounded-2xl p-6">
      <h3 className="text-white font-bold mb-5">Take a Position</h3>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => !stakedYes && setSide('yes')}
          disabled={loading || stakedYes}
          title={stakedYes ? 'Already staked YES' : undefined}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
            stakedYes
              ? 'bg-white/[0.03] text-gray-600 cursor-not-allowed line-through'
              : side === 'yes'
              ? 'bg-green-500 text-white'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {stakedYes ? 'YES · staked' : 'YES'}
        </button>
        <button
          onClick={() => !stakedNo && setSide('no')}
          disabled={loading || stakedNo}
          title={stakedNo ? 'Already staked NO' : undefined}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
            stakedNo
              ? 'bg-white/[0.03] text-gray-600 cursor-not-allowed line-through'
              : side === 'no'
              ? 'bg-red-500 text-white'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {stakedNo ? 'NO · staked' : 'NO'}
        </button>
      </div>

      <input
        type="number"
        min="0"
        step="any"
        placeholder="Amount (USDCx)"
        value={amount}
        onChange={e => { setAmount(e.target.value); setError('') }}
        disabled={loading}
        className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-4 focus:outline-none focus:border-quorum-500/50 disabled:opacity-50"
      />

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      {loading && status && (
        <p className="text-quorum-500 text-xs mb-3 animate-pulse">{status}</p>
      )}
      {txHash && !loading && (
        <p className="text-xs text-gray-400 mb-3">
          Deposit tx:{' '}
          <a
            href={`https://explorer.hiro.so/txid/${txHash}?chain=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-quorum-500 hover:underline font-mono"
          >
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </a>
        </p>
      )}

      <button
        onClick={handleStake}
        disabled={loading}
        className="w-full bg-quorum-500 hover:bg-quorum-400 disabled:opacity-50 text-[#0A0A0B] font-bold py-3 rounded-xl text-sm transition-colors"
      >
        {loading ? 'Processing…' : `Stake ${side.toUpperCase()}${amount ? ` — ${amount} USDCx` : ''}`}
      </button>

      <p className="text-gray-600 text-xs text-center mt-4">
        Deposited into agent vault · AI resolves · Winners paid via FlowVault
      </p>
    </div>
  )
}
