'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import WalletConnect from '@/components/WalletConnect'

interface AuthUser {
  id: string
  email: string
  wallet_address: string | null
  display_name: string | null
}

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setUser(d.user || null))
      .catch(() => setUser(null))
      .finally(() => setAuthLoaded(true))
  }, [pathname])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
  }

  const avatarInitial = user
    ? (user.display_name || user.email)[0].toUpperCase()
    : ''

  // FAQs only shown when not logged in
  const navLinks = [
    { label: 'Markets', href: '/markets' },
    { label: 'History', href: '/history' },
    ...(!user ? [{ label: 'FAQs', href: '/#faq' }] : []),
  ]

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/5 py-4'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <span className="font-heading font-black text-white text-xl tracking-tighter uppercase transition-opacity group-hover:opacity-80">
              QUORUM<span className="text-quorum-500">.</span>
            </span>
          </Link>

          {/* Centered Pill Links (Desktop) */}
          <div className="hidden md:flex items-center justify-center flex-1">
            <div className="flex items-center gap-6 bg-white/[0.03] border border-white/10 rounded-full px-6 py-2.5 backdrop-blur-md">
              {navLinks.map((l) => {
                const isActive = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href) && !l.href.includes('#'))
                return (
                  <Link
                    key={l.label}
                    href={l.href}
                    className={`text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right Actions */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-auto">
            {/* Hiro wallet — compact */}
            <WalletConnect />

            {/* Auth section */}
            {authLoaded && (
              <>
                {user ? (
                  <div className="flex items-center gap-1.5">
                    <Link
                      href="/account"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#4F6EF7] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {avatarInitial}
                      </span>
                      <span className="text-sm text-gray-300 max-w-[80px] truncate">
                        {user.display_name || user.email.split('@')[0]}
                      </span>
                    </Link>
                    <Link
                      href="/create"
                      className="px-4 py-1.5 bg-quorum-500 hover:bg-quorum-400 text-[#0A0A0B] font-bold rounded-lg text-sm transition-all whitespace-nowrap"
                    >
                      + Create
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/auth"
                    className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-medium rounded-lg text-sm transition-all whitespace-nowrap"
                  >
                    Sign In
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden ml-auto p-2 text-gray-400 hover:text-white transition-colors border border-white/10 rounded-lg bg-white/5"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-[#0A0A0B]/95 backdrop-blur-2xl flex flex-col items-center justify-center gap-8 pt-20">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="text-2xl font-heading font-bold text-white hover:text-quorum-500 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 mt-4 w-64">
            <WalletConnect />
            {user ? (
              <>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 text-center bg-white/[0.06] border border-white/10 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  <span className="w-6 h-6 rounded-full bg-[#4F6EF7] flex items-center justify-center text-white text-xs font-bold">
                    {avatarInitial}
                  </span>
                  Account
                </Link>
                <Link
                  href="/create"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-4 text-center bg-quorum-500 text-[#0A0A0B] font-bold rounded-xl"
                >
                  Create Market
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); handleLogout() }}
                  className="w-full py-3 text-center bg-red-500/10 border border-red-500/20 text-red-400 font-semibold rounded-xl"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMobileOpen(false)}
                className="w-full py-4 text-center bg-white/[0.06] border border-white/10 text-white font-bold rounded-xl"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}
