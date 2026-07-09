'use client'
import { useWallet } from '@/lib/wallet-context'

export default function WalletConnect() {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet()

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  if (walletAddress) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-sm font-mono text-gray-300">{truncate(walletAddress)}</span>
        <button
          onClick={disconnectWallet}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={connectWallet}
      className="px-4 py-2 bg-quorum-500 hover:bg-quorum-400 text-surface-dark font-semibold rounded-lg text-sm transition-all"
    >
      Connect Wallet
    </button>
  )
}
