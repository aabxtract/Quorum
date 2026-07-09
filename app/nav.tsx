'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const navLinks = [
  { label: 'Markets', href: '/markets' },
  { label: 'History', href: '/history' },
  { label: 'FAQs', href: '/#faq' },
]

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

  // Load auth state
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setUser(d.user || null))
      .catch(() => setUser(null))
      .finally(() => setAuthLoaded(true))
  }, [pathname]) // Re-check on route change

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
  }

  const avatarInitial = user
    ? (user.display_name || user.email)[0].toUpperCase()
    : ''

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/5 py-4'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0 w-48">
            <span className="font-heading font-black text-white text-xl tracking-tighter uppercase transition-opacity group-hover:opacity-80">
              QUORUM<span className="text-quorum-500">.</span>
            </span>
          </Link>

          {/* Centered Pill Links (Desktop) */}
          <div className="hidden md:flex items-center justify-center flex-1">
            <div className="flex items-center gap-8 bg-white/[0.03] border border-white/10 rounded-full px-8 py-3 backdrop-blur-md">
              {navLinks.map((l) => {
                const isActive = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href) && !l.href.includes('#'))
                return (
                  <Link
                    key={l.label}
                    href={l.href}
                    className={`text-sm font-medium transition-colors ${
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
          <div className="flex items-center justify-end gap-3 w-48">
            {/* Auth section */}
            {authLoaded && (
              <div className="hidden sm:block">
                {user ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/account"
                      id="nav-account-link"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all"
                    >
                      {/* Avatar */}
                      <span className="w-6 h-6 rounded-full bg-[#4F6EF7] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {avatarInitial}
                      </span>
                      <span className="text-sm text-gray-300 max-w-[100px] truncate">
                        {user.display_name || user.email.split('@')[0]}
                      </span>
                    </Link>
                    <button
                      id="nav-logout"
                      onClick={handleLogout}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors px-1"
                    >
                      Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/auth"
                    id="nav-signin-link"
                    className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-medium rounded-lg text-sm transition-all"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            )}

            {user && (
              <Link
                href="/create"
                className="hidden sm:block px-6 py-2.5 bg-quorum-500 hover:bg-quorum-400 text-[#0A0A0B] font-bold rounded-lg text-sm transition-all"
              >
                Create
              </Link>
            )}

            {/* Mobile burger */}
            <button
              className="md:hidden ml-1 p-2 text-gray-400 hover:text-white transition-colors border border-white/10 rounded-lg bg-white/5"
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
          <div className="flex flex-col gap-4 mt-4 w-64">
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
            {user && (
              <Link
                href="/create"
                onClick={() => setMobileOpen(false)}
                className="w-full py-4 text-center bg-quorum-500 text-[#0A0A0B] font-bold rounded-xl"
              >
                Create Market
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}
