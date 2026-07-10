'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { requestLeatherStxAddress } from './leather'

interface WalletContextValue {
  walletAddress: string | null
  walletLoading: boolean
  /** Opens Leather popup + saves the address locally. */
  connectWallet: () => Promise<void>
  /** Clears local wallet state (does NOT log the user out of their account). */
  disconnectWallet: () => void
  /** Re-fetches /api/auth/me and pulls the linked wallet address. Call after
   *  login / signup / link-wallet so the staking UI updates without a reload. */
  refreshFromAuth: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue>({
  walletAddress: null,
  walletLoading: true,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  refreshFromAuth: async () => {},
})

// LocalStorage fallback for wallet-only sessions (no auth account yet).
const STORAGE_KEY = 'quorum:wallet-address'

async function fetchAuthWallet(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data?.user?.wallet_address ?? null
  } catch {
    return null
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)

  // Priority: authed user's linked wallet > localStorage fallback.
  // We check both in parallel so a stale localStorage never wins over the
  // canonical value in the auth session.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [authWallet, saved] = [
        await fetchAuthWallet(),
        (() => {
          try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
        })(),
      ]
      if (cancelled) return
      const addr = authWallet ?? saved
      if (addr) setWalletAddress(addr)
      setWalletLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshFromAuth = useCallback(async () => {
    const authWallet = await fetchAuthWallet()
    if (authWallet) {
      setWalletAddress(authWallet)
      try { localStorage.setItem(STORAGE_KEY, authWallet) } catch {}
    }
  }, [])

  const connectWallet = useCallback(async () => {
    try {
      const addr = await requestLeatherStxAddress()
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
    <WalletContext.Provider
      value={{ walletAddress, walletLoading, connectWallet, disconnectWallet, refreshFromAuth }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
