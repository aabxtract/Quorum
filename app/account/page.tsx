'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  email: string
  wallet_address: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
  last_login_at: string | null
}

interface Stake {
  id: string
  side: 'yes' | 'no'
  amount: string
  payout_amount: string | null
  tx_hash: string | null
  created_at: string
  market_id: string
  question: string
  symbol: string
  market_status: string
  winning_side: string | null
  resolution_price: string | null
}

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [stakes, setStakes] = useState<Stake[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [linkingWallet, setLinkingWallet] = useState(false)
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.user) {
          router.replace('/auth')
        } else {
          setUser(d.user)
          setStakes(d.stakes || [])
        }
      })
      .catch(() => router.replace('/auth'))
      .finally(() => setLoading(false))
  }, [router])

  const logout = async () => {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const linkWallet = async () => {
    setLinkError('')
    setLinkingWallet(true)
    try {
      const { AppConfig, UserSession, showConnect } = await import('@stacks/connect')
      const appConfig = new AppConfig(['store_write', 'publish_data'])
      const userSession = new UserSession({ appConfig })

      const getAddr = () => {
        const profile = userSession.loadUserData()
        return profile.profile.stxAddress.testnet || profile.profile.stxAddress.mainnet
      }

      const submit = async (addr: string) => {
        const res = await fetch('/api/auth/link-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: addr }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to link wallet')
        setUser(data.user)
      }

      if (userSession.isUserSignedIn()) {
        await submit(getAddr())
        return
      }

      await new Promise<void>((resolve, reject) => {
        showConnect({
          appDetails: { name: 'Quorum', icon: '/favicon.ico' },
          userSession,
          onFinish: async () => {
            try {
              await submit(getAddr())
              resolve()
            } catch (e) { reject(e) }
          },
          onCancel: () => reject(new Error('Cancelled')),
        })
      })
    } catch (e: any) {
      const msg = e?.message || String(e)
      setLinkError(msg === 'Cancelled' ? 'Wallet connection cancelled' : msg)
    } finally {
      setLinkingWallet(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#4F6EF7] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading your account…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  // P&L calculation
  const resolvedStakes = stakes.filter(s => s.market_status === 'resolved')
  const totalStaked = resolvedStakes.reduce((acc, s) => acc + parseFloat(s.amount), 0)
  const totalPayout = resolvedStakes.reduce(
    (acc, s) => acc + parseFloat(s.payout_amount || '0'),
    0
  )
  const pnl = totalPayout - totalStaked
  const wins = resolvedStakes.filter(s => s.winning_side === s.side).length

  const truncateAddr = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`

  return (
    <div className="min-h-screen bg-[#0A0A0B] pt-24 pb-20 px-6">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[#4F6EF7]/6 blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-4xl font-black text-white mb-1">
              {user.display_name || user.email.split('@')[0]}
            </h1>
            <p className="text-gray-500 text-sm">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/withdraw"
              className="px-5 py-2.5 bg-quorum-500/10 hover:bg-quorum-500/20 border border-quorum-500/20 hover:border-quorum-500/40 text-quorum-500 font-medium rounded-xl text-sm transition-all"
            >
              Withdraw
            </Link>
            <button
              id="account-logout"
              onClick={logout}
              disabled={loggingOut}
              className="px-5 py-2.5 bg-white/[0.04] hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-gray-400 hover:text-red-400 font-medium rounded-xl text-sm transition-all disabled:opacity-50"
            >
              {loggingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Staked" value={`${totalStaked.toFixed(2)} USDCx`} />
          <StatCard label="Total Payout" value={`${totalPayout.toFixed(2)} USDCx`} />
          <StatCard
            label="P&L"
            value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDCx`}
            positive={pnl >= 0}
            negative={pnl < 0}
          />
          <StatCard label="Win Rate" value={resolvedStakes.length ? `${Math.round((wins / resolvedStakes.length) * 100)}%` : '—'} />
        </div>

        {/* Profile Info */}
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <InfoCard label="Email" value={user.email} icon="✉️" />
          <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl px-5 py-4 flex items-center gap-4">
            <span className="text-xl flex-shrink-0">🔗</span>
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-0.5">Wallet</p>
              {user.wallet_address ? (
                <p className="text-white text-sm font-medium truncate font-mono">
                  {truncateAddr(user.wallet_address)}
                </p>
              ) : (
                <div>
                  <p className="text-gray-500 text-sm mb-2">Not linked — required to stake</p>
                  <button
                    onClick={linkWallet}
                    disabled={linkingWallet}
                    className="px-3 py-1.5 bg-quorum-500/10 hover:bg-quorum-500/20 border border-quorum-500/30 text-quorum-500 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {linkingWallet ? 'Connecting…' : 'Link Wallet'}
                  </button>
                  {linkError && (
                    <p className="text-red-400 text-xs mt-2">{linkError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <InfoCard
            label="Member Since"
            value={new Date(user.created_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
            icon="📅"
          />
          <InfoCard
            label="Last Login"
            value={user.last_login_at
              ? new Date(user.last_login_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })
              : '—'}
            icon="🕐"
          />
        </div>

        {/* Stake History */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Stake History</h2>
          {stakes.length === 0 ? (
            <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-16 text-center">
              <p className="text-gray-500 mb-4">No stakes yet.</p>
              <Link
                href="/markets"
                className="inline-block px-6 py-3 bg-[#4F6EF7] hover:bg-[#6B86F8] text-white font-semibold rounded-xl text-sm transition-all"
              >
                Browse Markets
              </Link>
            </div>
          ) : (
            <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[#0A0A0F] text-gray-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Market</th>
                      <th className="px-6 py-4 font-medium">Side</th>
                      <th className="px-6 py-4 font-medium">Staked</th>
                      <th className="px-6 py-4 font-medium">Payout</th>
                      <th className="px-6 py-4 font-medium">Result</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E1E2E]">
                    {stakes.map((stake) => {
                      const isWin = stake.market_status === 'resolved' && stake.winning_side === stake.side
                      const isLoss = stake.market_status === 'resolved' && stake.winning_side && stake.winning_side !== stake.side
                      return (
                        <tr key={stake.id} className="hover:bg-[#1a1a24] transition-colors">
                          <td className="px-6 py-4">
                            <Link
                              href={`/markets/${stake.market_id}`}
                              className="text-white hover:text-[#4F6EF7] font-medium block max-w-[240px] truncate"
                              title={stake.question}
                            >
                              {stake.question}
                            </Link>
                            <span className="text-gray-600 text-xs font-mono">{stake.symbol}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              stake.side === 'yes'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {stake.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-300 font-mono">
                            {parseFloat(stake.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-gray-300 font-mono">
                            {stake.payout_amount ? parseFloat(stake.payout_amount).toFixed(2) : '—'}
                          </td>
                          <td className="px-6 py-4">
                            {stake.market_status === 'open' ? (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-400">
                                Open
                              </span>
                            ) : isWin ? (
                              <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400">
                                Won ✓
                              </span>
                            ) : isLoss ? (
                              <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400">
                                Lost
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs">
                            {new Date(stake.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string
  value: string
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-5">
      <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-xl font-bold font-mono ${
        positive ? 'text-green-400' : negative ? 'text-red-400' : 'text-white'
      }`}>
        {value}
      </p>
    </div>
  )
}

function InfoCard({
  label,
  value,
  icon,
  mono,
}: {
  label: string
  value: string
  icon: string
  mono?: boolean
}) {
  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl px-5 py-4 flex items-center gap-4">
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-0.5">{label}</p>
        <p className={`text-white text-sm font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}
