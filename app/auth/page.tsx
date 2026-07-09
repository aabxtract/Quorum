'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Tab = 'signin' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('signin')

  // Redirect if already logged in
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user) router.replace('/account') })
      .catch(() => {})
  }, [router])

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4 py-24">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#4F6EF7]/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-violet-600/5 blur-[80px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <span className="font-black text-white text-2xl tracking-tighter uppercase">
              QUORUM<span className="text-[#4F6EF7]">.</span>
            </span>
          </Link>
          <p className="text-gray-500 text-sm mt-2">Predict prices. Win on-chain. No middlemen.</p>
        </div>

        {/* Card */}
        <div className="bg-[#13131A]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40">
          {/* Tab toggle */}
          <div className="flex bg-[#0A0A0F]/60 rounded-xl p-1 mb-8 border border-white/5">
            {(['signin', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                id={`auth-tab-${t}`}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  tab === t
                    ? 'bg-[#4F6EF7] text-white shadow-lg shadow-[#4F6EF7]/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {tab === 'signin' ? <SignInForm /> : <SignUpForm onSuccess={() => setTab('signin')} />}
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Sign In ───────────────────────── */
function SignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [walletLoading, setWalletLoading] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/account')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleWalletLogin = async () => {
    setError('')
    setWalletLoading(true)
    try {
      const { AppConfig, UserSession, showConnect } = await import('@stacks/connect')
      const appConfig = new AppConfig(['store_write', 'publish_data'])
      const userSession = new UserSession({ appConfig })

      showConnect({
        appDetails: { name: 'Quorum', icon: '/favicon.ico' },
        userSession,
        onFinish: async () => {
          try {
            const profile = userSession.loadUserData()
            const walletAddress =
              profile.profile.stxAddress.testnet || profile.profile.stxAddress.mainnet

            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletAddress }),
            })
            const data = await res.json()
            if (!res.ok) {
              setError(data.error || 'Wallet not linked to any account. Please sign up first.')
            } else {
              router.push('/account')
            }
          } catch {
            setError('Failed to authenticate with wallet.')
          } finally {
            setWalletLoading(false)
          }
        },
        onCancel: () => setWalletLoading(false),
      })
    } catch {
      setError('Wallet connection failed.')
      setWalletLoading(false)
    }
  }

  return (
    <form onSubmit={handleEmailLogin} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="signin-email" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-widest">
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-[#0A0A0F] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#4F6EF7]/60 focus:ring-1 focus:ring-[#4F6EF7]/30 transition-all"
        />
      </div>
      <div>
        <label htmlFor="signin-password" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-widest">
          Password
        </label>
        <input
          id="signin-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full bg-[#0A0A0F] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#4F6EF7]/60 focus:ring-1 focus:ring-[#4F6EF7]/30 transition-all"
        />
      </div>
      <button
        id="signin-submit"
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#4F6EF7] hover:bg-[#6B86F8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-[#4F6EF7]/20 hover:shadow-[#4F6EF7]/30"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      <div className="relative flex items-center gap-3 my-2">
        <div className="flex-1 border-t border-white/5" />
        <span className="text-gray-600 text-xs">or</span>
        <div className="flex-1 border-t border-white/5" />
      </div>

      <button
        id="signin-wallet"
        type="button"
        onClick={handleWalletLogin}
        disabled={walletLoading}
        className="w-full py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50"
      >
        <HiroIcon />
        {walletLoading ? 'Connecting…' : 'Sign in with Hiro Wallet'}
      </button>
    </form>
  )
}

/* ───────────────────────── Sign Up ───────────────────────── */
function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [walletLoading, setWalletLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body: Record<string, string> = { email }
      if (password) body.password = password
      if (walletAddress) body.walletAddress = walletAddress

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess('Account created! Redirecting…')
      setTimeout(onSuccess, 1200)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const connectWallet = async () => {
    setError('')
    setWalletLoading(true)
    try {
      const { AppConfig, UserSession, showConnect } = await import('@stacks/connect')
      const appConfig = new AppConfig(['store_write', 'publish_data'])
      const userSession = new UserSession({ appConfig })

      showConnect({
        appDetails: { name: 'Quorum', icon: '/favicon.ico' },
        userSession,
        onFinish: () => {
          try {
            const profile = userSession.loadUserData()
            const addr =
              profile.profile.stxAddress.testnet || profile.profile.stxAddress.mainnet
            setWalletAddress(addr)
          } catch {
            setError('Could not read wallet data.')
          } finally {
            setWalletLoading(false)
          }
        },
        onCancel: () => setWalletLoading(false),
      })
    } catch {
      setError('Wallet connection failed.')
      setWalletLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignup} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      <div>
        <label htmlFor="signup-email" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-widest">
          Email <span className="text-[#4F6EF7]">*</span>
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-[#0A0A0F] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#4F6EF7]/60 focus:ring-1 focus:ring-[#4F6EF7]/30 transition-all"
        />
      </div>
      <div>
        <label htmlFor="signup-password" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-widest">
          Password {!walletAddress && <span className="text-[#4F6EF7]">*</span>}
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={walletAddress ? 'Optional with wallet' : 'At least 8 characters'}
          required={!walletAddress}
          className="w-full bg-[#0A0A0F] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#4F6EF7]/60 focus:ring-1 focus:ring-[#4F6EF7]/30 transition-all"
        />
      </div>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-white/5" />
        <span className="text-gray-600 text-xs">or add wallet</span>
        <div className="flex-1 border-t border-white/5" />
      </div>

      {walletAddress ? (
        <div className="flex items-center gap-3 bg-[#4F6EF7]/10 border border-[#4F6EF7]/20 rounded-xl px-4 py-3">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-sm font-mono text-gray-300 truncate">{walletAddress}</span>
          <button
            type="button"
            onClick={() => setWalletAddress('')}
            className="text-gray-500 hover:text-red-400 transition-colors ml-auto flex-shrink-0 text-xs"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          id="signup-connect-wallet"
          type="button"
          onClick={connectWallet}
          disabled={walletLoading}
          className="w-full py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <HiroIcon />
          {walletLoading ? 'Connecting…' : 'Connect Hiro Wallet'}
        </button>
      )}

      <button
        id="signup-submit"
        type="submit"
        disabled={loading || !!success}
        className="w-full py-3 bg-[#4F6EF7] hover:bg-[#6B86F8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-[#4F6EF7]/20"
      >
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  )
}

/* ─── Hiro Wallet Icon ─── */
function HiroIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <rect width="24" height="24" rx="6" fill="#6B46C1" />
      <path d="M7 7h4l2 5 2-5h4L15 17h-3l-2-5-2 5H5L7 7z" fill="white" />
    </svg>
  )
}
