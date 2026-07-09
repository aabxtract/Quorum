'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserVault } from '@/lib/flowvault-browser'
import { fromMicro } from '@/lib/flowvault-agent'

interface VaultState {
  unlocked: string
  locked: string
  lockUntilBlock?: string | number
}

export default function WithdrawPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [state, setState] = useState<VaultState | null>(null)
  const [currentBlock, setCurrentBlock] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)

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

  const refresh = async (addr: string) => {
    setRefreshing(true)
    setError('')
    try {
      const vault = createBrowserVault(addr)
      const [s, block] = await Promise.all([
        vault.getVaultState(addr),
        vault.getCurrentBlockHeight(addr).catch(() => null),
      ])
      setState(s as VaultState)
      if (block !== null) setCurrentBlock(Number(block))
    } catch (e: any) {
      setError(e?.message || 'Failed to read vault state')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (walletAddress) refresh(walletAddress)
  }, [walletAddress])

  async function handleWithdraw() {
    if (!walletAddress || !state) return
    const unlockedMicro = BigInt(state.unlocked || '0')
    if (unlockedMicro <= 0n) return setError('Nothing to withdraw')

    setLoading(true)
    setError('')
    setTxHash(null)
    setStatus('Requesting wallet signature…')

    try {
      const vault = createBrowserVault(walletAddress)
      const result = await vault.withdraw(unlockedMicro.toString())
      const id: string | undefined = (result as any)?.txId || (result as any)?.txid
      if (!id) throw new Error('Wallet did not return a tx id')
      setTxHash(id)
      setStatus('Withdraw broadcast — refreshing balance…')
      // Give the explorer a beat, then refresh
      setTimeout(() => refresh(walletAddress), 4000)
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(/user (rejected|denied|cancel)/i.test(msg) ? 'Signature cancelled' : msg)
    } finally {
      setLoading(false)
    }
  }

  if (!walletAddress) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-xl mx-auto min-h-screen">
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Wallet to Withdraw</h2>
          <p className="text-gray-400 text-sm">Use the Connect Wallet button in the navigation.</p>
        </div>
      </div>
    )
  }

  const unlocked = state ? fromMicro(state.unlocked || '0') : 0
  const locked = state ? fromMicro(state.locked || '0') : 0
  const lockUntil = state?.lockUntilBlock ? Number(state.lockUntilBlock) : null
  const blocksRemaining = lockUntil && currentBlock ? Math.max(0, lockUntil - currentBlock) : null

  return (
    <div className="pt-24 pb-20 px-6 max-w-2xl mx-auto min-h-screen">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black mb-2">Withdraw</h1>
          <p className="text-gray-400 text-sm">Pull unlocked USDCx directly from your FlowVault.</p>
        </div>
        <button
          onClick={() => refresh(walletAddress)}
          disabled={refreshing}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 disabled:opacity-50"
        >
          {refreshing ? '↻' : '↻ Refresh'}
        </button>
      </div>

      <div className="bg-[#121214] border border-white/5 rounded-2xl p-8 mb-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Unlocked</p>
            <p className="text-3xl font-bold font-mono text-green-400">
              {refreshing && !state ? '…' : unlocked.toFixed(6)}
            </p>
            <p className="text-gray-600 text-xs mt-1">USDCx · claimable now</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Locked</p>
            <p className="text-3xl font-bold font-mono text-orange-400">
              {refreshing && !state ? '…' : locked.toFixed(6)}
            </p>
            <p className="text-gray-600 text-xs mt-1">
              USDCx · {blocksRemaining !== null
                ? blocksRemaining > 0
                  ? `unlocks in ~${blocksRemaining} blocks`
                  : 'ready — refresh state'
                : 'reserve'}
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Wallet</p>
          <p className="font-mono text-sm text-gray-300 break-all">{walletAddress}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm mb-4">
          {error}
        </div>
      )}
      {status && !error && (
        <div className="p-3 bg-quorum-500/10 border border-quorum-500/20 text-quorum-500 rounded-xl text-sm mb-4">
          {status}
        </div>
      )}
      {txHash && (
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-sm mb-4">
          <span className="text-gray-500">Withdraw tx: </span>
          <a
            href={`https://explorer.hiro.so/txid/${txHash}?chain=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-quorum-500 hover:underline font-mono"
          >
            {txHash.slice(0, 12)}…{txHash.slice(-8)}
          </a>
        </div>
      )}

      <button
        onClick={handleWithdraw}
        disabled={loading || unlocked <= 0}
        className="w-full py-4 bg-quorum-500 hover:bg-quorum-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] font-bold rounded-xl transition-all"
      >
        {loading
          ? 'Processing…'
          : unlocked <= 0
            ? 'Nothing to withdraw'
            : `Withdraw ${unlocked.toFixed(6)} USDCx`}
      </button>

      <div className="mt-8 text-center">
        <Link href="/account" className="text-sm text-gray-500 hover:text-white">
          ← Back to account
        </Link>
      </div>
    </div>
  )
}
