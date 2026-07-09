'use client'
import { useWallet } from '@/lib/wallet-context'

export default function WalletConnect() {
  const { walletAddress, walletLoading, connectWallet, disconnectWallet } = useWallet()

  // Don't render anything until localStorage has been checked — prevents
  // the "Connect Wallet" button from flashing for already-connected wallets.
  if (walletLoading) {
    return <div className="w-24 h-8 rounded-lg bg-white/5 animate-pulse" />
  }

  if (walletAddress) {
    const truncated = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
        <span className="text-sm font-mono text-gray-300">{truncated}</span>
        <button
          onClick={disconnectWallet}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors ml-1"
          title="Disconnect wallet"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={connectWallet}
      className="px-4 py-1.5 bg-quorum-500 hover:bg-quorum-400 text-[#0A0A0B] font-semibold rounded-lg text-sm transition-all whitespace-nowrap"
    >
      Connect Wallet
    </button>
  )
}
