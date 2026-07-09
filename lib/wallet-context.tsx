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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)

  // Read persisted session on mount — keep loading=true until the async
  // import settles so components never flash "Connect Wallet" for already-
  // connected wallets.
  useEffect(() => {
    import('@stacks/connect').then(({ AppConfig, UserSession }) => {
      try {
        const appConfig = new AppConfig(['store_write', 'publish_data'])
        const userSession = new UserSession({ appConfig })
        if (userSession.isUserSignedIn()) {
          const profile = userSession.loadUserData()
          const addr =
            profile.profile.stxAddress.testnet || profile.profile.stxAddress.mainnet
          setWalletAddress(addr)
        }
      } catch {
        /* no stored session */
      } finally {
        setWalletLoading(false)
      }
    }).catch(() => setWalletLoading(false))
  }, [])

  const connectWallet = useCallback(async () => {
    const { AppConfig, UserSession, showConnect, getStacksProvider } = await import('@stacks/connect')
    const appConfig = new AppConfig(['store_write', 'publish_data'])
    const userSession = new UserSession({ appConfig })
    const provider = getStacksProvider()

    return new Promise<void>((resolve) => {
      showConnect({
        appDetails: { name: 'Quorum', icon: '/favicon.ico' },
        userSession,
        ...(provider ? { provider } : {}),
        onFinish: () => {
          try {
            const profile = userSession.loadUserData()
            const addr =
              profile.profile.stxAddress.testnet || profile.profile.stxAddress.mainnet
            setWalletAddress(addr)
          } catch {
            window.location.reload()
          }
          resolve()
        },
        onCancel: () => resolve(),
      })
    })
  }, [])

  const disconnectWallet = useCallback(() => {
    import('@stacks/connect').then(({ AppConfig, UserSession }) => {
      const appConfig = new AppConfig(['store_write', 'publish_data'])
      const userSession = new UserSession({ appConfig })
      userSession.signUserOut('/')
    })
    setWalletAddress(null)
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
