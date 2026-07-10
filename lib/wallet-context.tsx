'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

interface WalletContextValue {
  walletAddress: string | null
  walletLoading: boolean
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
}

const WalletContext = createContext<WalletContextValue>({
  walletAddress: null,
  walletLoading: true,
  connectWallet: async () => {},
  disconnectWallet: () => {},
})

// LocalStorage key so the wallet stays "connected" across reloads without
// leaning on @stacks/connect's legacy UserSession.
const STORAGE_KEY = 'quorum:wallet-address'

function getLeatherProvider(): any {
  if (typeof window === 'undefined') return undefined
  const w = window as any
  return w.LeatherProvider ?? w.HiroWalletProvider ?? w.StacksProvider
}

/**
 * Ask Leather for the user's addresses via SIP-030 `getAddresses`.
 * Response shape: { result: { addresses: [{ address, symbol, ... }, ...] } }
 * where `symbol` is 'STX' or 'BTC'.
 */
async function requestLeatherAddresses(): Promise<string | null> {
  const provider = getLeatherProvider()
  if (!provider || typeof provider.request !== 'function') {
    throw new Error(
      'Leather/Hiro Wallet not detected. Install the Leather extension (https://leather.io) and reload the page.'
    )
  }

  const response = await provider.request('getAddresses')

  if (response?.error) {
    const e = response.error
    if (e.code === 4001) return null // user cancelled
    throw new Error(`Leather ${e.code}: ${e.message}`)
  }

  const addresses: any[] = response?.result?.addresses ?? []
  const stx = addresses.find(
    (a) => a.symbol === 'STX' || a.address?.startsWith('S')
  )
  return stx?.address ?? null
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)

  // Restore previously connected wallet from localStorage. No wallet popup —
  // we just remember what the user last connected as. The real SIP-030
  // handshake happens again on the first stx_callContract, which is fine.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setWalletAddress(saved)
    } catch {
      /* localStorage disabled */
    }
    setWalletLoading(false)
  }, [])

  const connectWallet = useCallback(async () => {
    try {
      const addr = await requestLeatherAddresses()
      if (addr) {
        setWalletAddress(addr)
        try { localStorage.setItem(STORAGE_KEY, addr) } catch {}
      }
    } catch (err: any) {
      console.error('[wallet] connect failed:', err?.message || err)
      alert(err?.message || 'Failed to connect wallet')
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  return (
    <WalletContext.Provider value={{ walletAddress, walletLoading, connectWallet, disconnectWallet }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
