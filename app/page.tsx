'use client';
import Link from 'next/link';
import useSWR from 'swr';
import MarketCard, { Market } from '@/components/MarketCard';
import AgentFeed from '@/components/AgentFeed';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const faqs = [
  { q: 'How does AI resolution work?', a: 'When a market expires, our autonomous AI agent fetches the live price from CoinMarketCap, checks whether the condition was met, and declares a winner — all without any human input. Resolution typically happens within seconds of the deadline.' },
  { q: 'How do I know the settlement is fair?', a: 'Your funds never sit in a centralized wallet. FlowVault, a smart contract on the Stacks blockchain, holds every stake and distributes winnings atomically the moment the AI resolves the market. No one can touch your funds in between.' },
  { q: 'What is FlowVault?', a: 'FlowVault is the on-chain settlement engine that powers Quorum. It escrows stakes, calculates winner payouts, and sends funds directly to winning wallets — all in a single atomic transaction. No manual claiming, no waiting, no trust required.' },
  { q: 'Do I need a wallet to trade?', a: 'Yes. You need the Hiro Wallet browser extension to stake on any market. Your wallet is your identity on-chain — it holds your USDCx and receives your winnings automatically when you win.' },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(!open)}
      className="cursor-pointer rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 px-7 py-6 transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-white/90 text-lg">{q}</span>
        <span className={`text-xl transition-transform ${open ? 'rotate-45 text-quorum-500' : 'text-gray-500'}`}>+</span>
      </div>
      {open && (
        <p className="mt-4 text-sm text-gray-400 leading-relaxed pt-4 border-t border-white/5">
          {a}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const { data, error } = useSWR('/api/markets', fetcher);
  const openMarkets = data?.markets?.filter((m: Market) => m.status === 'open') || [];

  return (
    <div className="relative min-h-screen bg-[#0A0A0B] overflow-hidden selection:bg-quorum-500/30 selection:text-white">

      {/* ── Aurora pillars ── tall soft rectangles falling from the top edge */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        {/* Left cluster — teal */}
        <div style={{ position:'absolute', top:0, left:'8%',  width:55, height:600, borderRadius:6, filter:'blur(28px)', background:'linear-gradient(to bottom, rgba(12,242,196,0.9) 0%, rgba(12,242,196,0.4) 50%, transparent 100%)' }} />
        <div style={{ position:'absolute', top:0, left:'12%', width:70, height:680, borderRadius:6, filter:'blur(32px)', background:'linear-gradient(to bottom, rgba(12,242,196,1)   0%, rgba(12,242,196,0.5) 45%, transparent 100%)' }} />
        <div style={{ position:'absolute', top:0, left:'17%', width:50, height:540, borderRadius:6, filter:'blur(24px)', background:'linear-gradient(to bottom, rgba(12,242,196,0.7) 0%, rgba(12,242,196,0.3) 50%, transparent 100%)' }} />
        <div style={{ position:'absolute', top:0, left:'21%', width:40, height:440, borderRadius:6, filter:'blur(20px)', background:'linear-gradient(to bottom, rgba(12,242,196,0.5) 0%, rgba(12,242,196,0.15)50%, transparent 100%)' }} />

        {/* Right cluster — orange */}
        <div style={{ position:'absolute', top:0, right:'8%',  width:55, height:600, borderRadius:6, filter:'blur(28px)', background:'linear-gradient(to bottom, rgba(249,115,22,0.9) 0%, rgba(249,115,22,0.4) 50%, transparent 100%)' }} />
        <div style={{ position:'absolute', top:0, right:'12%', width:70, height:680, borderRadius:6, filter:'blur(32px)', background:'linear-gradient(to bottom, rgba(249,115,22,1)   0%, rgba(249,115,22,0.5) 45%, transparent 100%)' }} />
        <div style={{ position:'absolute', top:0, right:'17%', width:50, height:540, borderRadius:6, filter:'blur(24px)', background:'linear-gradient(to bottom, rgba(249,115,22,0.7) 0%, rgba(249,115,22,0.3) 50%, transparent 100%)' }} />
        <div style={{ position:'absolute', top:0, right:'21%', width:40, height:440, borderRadius:6, filter:'blur(20px)', background:'linear-gradient(to bottom, rgba(249,115,22,0.5) 0%, rgba(249,115,22,0.15)50%, transparent 100%)' }} />

        {/* Floor fade */}
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/80 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-24 relative z-10">

        {/* ─── HERO SECTION ────────────────────────────── */}
        <section className="relative overflow-hidden text-center max-w-6xl mx-auto mb-24 flex flex-col items-center justify-center py-16">
          <h1 className="relative z-10 text-4xl md:text-6xl font-bold tracking-tight leading-[1.08] text-white mb-5">
            Predict the Price.<br />
            Get Paid Instantly.
          </h1>

          <p className="relative z-10 text-sm md:text-base text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Call it right and FlowVault sends your winnings straight to your wallet — no middlemen, no delays, no trust required. The AI checks the result. The blockchain handles the rest.
          </p>

          <Link
            href="/auth"
            className="relative z-10 px-8 py-3.5 bg-white hover:bg-gray-100 text-[#0A0A0B] font-bold rounded-full transition-all text-sm"
          >
            Start Trading Now
          </Link>
          <div className="relative z-10 mt-12 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              {/* Left Card: Flash Markets */}
              <div className="group relative bg-[#121214] rounded-3xl p-8 overflow-hidden border border-white/5 hover:border-white/10 transition-colors">
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-[url('/dot-grid.svg')] bg-[length:24px_24px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
                <div className="absolute top-[-50px] left-[-50px] w-[200px] h-[200px] bg-quorum-500/20 blur-[80px] rounded-full pointer-events-none group-hover:bg-quorum-500/30 transition-all"></div>

                <div className="relative z-10">
                  <h3 className="text-white font-bold text-xl mb-3">Flash Markets</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Pick a direction. Set a time. Know the outcome in minutes.
                    Flash markets resolve in 5 to 60 minutes — built for traders who want to act on price moves right now, not next week.
                  </p>
                </div>
              </div>

              {/* Right Card: Position Markets */}
              <div className="group relative bg-[#121214] rounded-3xl p-8 overflow-hidden border border-white/5 hover:border-white/10 transition-colors">
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-[url('/dot-grid.svg')] bg-[length:24px_24px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
                <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-orange-500/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-all"></div>

                <div className="relative z-10">
                  <h3 className="text-white font-bold text-xl mb-3">Position Markets</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Play the bigger picture.
                    Position markets run for hours or days — perfect when you have a macro conviction and want time to prove it right. Back your thesis and let the chart do the talking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

                  {/* ─── HOW IT WORKS ───────────────────────────── */}
                  <section className="relative mb-0 py-16 flex items-center">
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-1/2 top-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-quorum-500/10 blur-[150px]" />
                      <div className="absolute right-10 top-0 h-[260px] w-[260px] rounded-full bg-orange-500/10 blur-[120px]" />
                    </div>

                    <div className="relative z-10 w-full">
                      <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-black text-white">Four steps, one automated outcome</h2>
                        <p className="mt-4 text-sm md:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
                          The app keeps the flow simple: choose a market, stake through your wallet, let the AI resolve it, and receive winnings directly on-chain.
                        </p>
                      </div>

                      <div className="relative grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch isolate">
                        <div className="relative z-10 md:col-span-4">
                          <div className="h-full rounded-3xl border border-white/5 bg-[#121214] p-6 md:p-7 shadow-[0_0_0_1px_rgba(12,242,196,0.04)]">
                            <div className="w-10 h-10 rounded-full bg-quorum-500/10 border border-quorum-500/20 flex items-center justify-center mb-5">
                              <span className="text-quorum-500 font-bold text-sm">01</span>
                            </div>
                            <h3 className="text-white font-bold text-xl mb-3">Pick a market</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                              Browse flash or position markets and choose the one that matches your time horizon and conviction.
                            </p>
                          </div>
                        </div>

                        <div className="relative z-10 md:col-span-4 md:row-span-2 md:flex md:items-center md:justify-center">
                          <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_24px_rgba(255,255,255,0.04)]">
                            <img src="/favicon.png" alt="Quorum logo" className="h-24 w-24 object-contain" />
                          </div>
                        </div>

                        <div className="relative z-10 md:col-span-4">
                          <div className="h-full rounded-3xl border border-white/5 bg-[#121214] p-6 md:p-7 shadow-[0_0_0_1px_rgba(249,115,22,0.04)]">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-5">
                              <span className="text-orange-400 font-bold text-sm">02</span>
                            </div>
                            <h3 className="text-white font-bold text-xl mb-3">Connect your wallet</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                              Sign in, connect Hiro, and stake from your wallet so the app can settle everything directly to your address.
                            </p>
                          </div>
                        </div>

                        <div className="md:col-span-4 md:col-start-1">
                          <div className="h-full rounded-3xl border border-white/5 bg-[#121214] p-6 md:p-7">
                            <div className="w-10 h-10 rounded-full bg-quorum-500/10 border border-quorum-500/20 flex items-center justify-center mb-5">
                              <span className="text-quorum-500 font-bold text-sm">03</span>
                            </div>
                            <h3 className="text-white font-bold text-xl mb-3">Wait for AI resolution</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                              The resolution agent watches the market and checks the live price when the market expires.
                            </p>
                          </div>
                        </div>

                        <div className="md:col-span-4 md:col-start-9">
                          <div className="h-full rounded-3xl border border-white/5 bg-[#121214] p-6 md:p-7">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-5">
                              <span className="text-orange-400 font-bold text-sm">04</span>
                            </div>
                            <h3 className="text-white font-bold text-xl mb-3">Receive your payout</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                              If you win, FlowVault sends the funds to your wallet automatically. No manual claim flow, no waiting.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ─── WHY QUORUM ───────────────────────────── */}
                  <section className="relative mb-0 py-16 flex items-center">
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-1/2 top-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-quorum-500/10 blur-[150px]" />
                      <div className="absolute right-10 top-0 h-[260px] w-[260px] rounded-full bg-orange-500/10 blur-[120px]" />
                    </div>

                    <div className="relative z-10 w-full">
                      <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-black text-white">AI reads public APIs, settlement happens automatically</h2>
                        <p className="mt-4 text-sm md:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
                          Quorum keeps the flow simple: public data is read by the agent, the contract settles the result, and the math does the rest.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group relative rounded-3xl border border-white/5 bg-[#121214] p-8 overflow-hidden">
                          <div className="absolute inset-x-0 top-0 h-1/2 bg-[url('/dot-grid.svg')] bg-[length:24px_24px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
                          <div className="absolute top-[-60px] left-[-60px] h-[220px] w-[220px] rounded-full bg-quorum-500/15 blur-[90px]"></div>
                          <div className="relative z-10">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-quorum-500/20 bg-quorum-500/10 text-quorum-500 font-bold text-sm mb-6">01</span>
                            <h3 className="text-white font-bold text-2xl mb-3">AI reads public APIs</h3>
                            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                              The agent watches live public data sources and prices, then decides what the market outcome should be.
                            </p>
                          </div>
                        </div>

                        <div className="group relative rounded-3xl border border-white/5 bg-[#121214] p-8 overflow-hidden">
                          <div className="absolute inset-x-0 top-0 h-1/2 bg-[url('/dot-grid.svg')] bg-[length:24px_24px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
                          <div className="absolute top-[-60px] right-[-60px] h-[220px] w-[220px] rounded-full bg-orange-500/15 blur-[90px]"></div>
                          <div className="relative z-10">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 font-bold text-sm mb-6">02</span>
                            <h3 className="text-white font-bold text-2xl mb-3">Automatic settlement</h3>
                            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                              Once the condition is met, the contract settles the outcome automatically without manual intervention.
                            </p>
                          </div>
                        </div>

                        <div className="group relative rounded-3xl border border-white/5 bg-[#121214] p-8 overflow-hidden">
                          <div className="absolute inset-x-0 top-0 h-1/2 bg-[url('/dot-grid.svg')] bg-[length:24px_24px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
                          <div className="absolute top-[-60px] left-[-60px] h-[220px] w-[220px] rounded-full bg-quorum-500/15 blur-[90px]"></div>
                          <div className="relative z-10">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-quorum-500/20 bg-quorum-500/10 text-quorum-500 font-bold text-sm mb-6">03</span>
                            <h3 className="text-white font-bold text-2xl mb-3">Trust the contract</h3>
                            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                              Funds stay on-chain, the rules are fixed, and the contract enforces the payout with no human override.
                            </p>
                          </div>
                        </div>

                        <div className="group relative rounded-3xl border border-white/5 bg-[#121214] p-8 overflow-hidden">
                          <div className="absolute inset-x-0 top-0 h-1/2 bg-[url('/dot-grid.svg')] bg-[length:24px_24px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
                          <div className="absolute top-[-60px] right-[-60px] h-[220px] w-[220px] rounded-full bg-orange-500/15 blur-[90px]"></div>
                          <div className="relative z-10">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 font-bold text-sm mb-6">04</span>
                            <h3 className="text-white font-bold text-2xl mb-3">Math resolves it</h3>
                            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                              The final result is deterministic: the numbers decide, the math resolves, and the winner gets paid.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

        {/* ─── LIVE MARKETS (App integration) ──────────── */}
        <section id="markets" className="mb-0 py-16 flex items-center">
          <div className="w-full">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-black text-white">Active Markets</h2>
            <Link href="/markets" className="text-sm font-medium text-gray-400 hover:text-white bg-white/5 px-4 py-2 rounded-lg">View all</Link>
          </div>
          
          {error ? (
            <div className="p-8 text-center bg-red-500/10 rounded-2xl text-red-400">Failed to load markets</div>
          ) : !data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-56 bg-white/5 rounded-2xl animate-pulse"></div>)}
            </div>
          ) : openMarkets.length === 0 ? (
            <div className="p-12 text-center bg-white/5 rounded-2xl border border-white/10">
              <p className="text-gray-400 mb-4">No open markets right now.</p>
              <Link href="/create" className="text-quorum-500 font-bold hover:underline">Create the first one</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {openMarkets.slice(0, 3).map((market: Market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}
          </div>
        </section>
        {/* FAQs */}
        <section id="faq" className="max-w-3xl mx-auto flex items-center border-t border-white/10 pt-16 pb-16">
          <div className="w-full">
            <h2 className="text-3xl font-black text-white mb-10 text-center">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="flex items-center py-16">
          <div className="relative overflow-hidden rounded-none border-y border-white/10 bg-[#121214] px-8 py-16 md:px-16 md:py-20 text-center w-full">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/2 top-[-80px] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-quorum-500/15 blur-[120px]" />
                <div className="absolute right-[-80px] bottom-[-80px] h-[280px] w-[280px] rounded-full bg-orange-500/10 blur-[120px]" />
              </div>

              <div className="relative z-10">
                <h2 className="text-3xl md:text-5xl font-black text-white leading-tight max-w-3xl mx-auto">
                  Trade with automated settlement and clear rules.
                </h2>
                <p className="mt-5 text-sm md:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
                  Join Quorum, connect your wallet, and begin trading markets that resolve automatically on-chain.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/auth"
                    className="px-8 py-3.5 bg-white hover:bg-gray-100 text-[#0A0A0B] font-bold rounded-full transition-all text-sm"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/markets"
                    className="px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-full transition-all text-sm"
                  >
                    Browse Markets
                  </Link>
                </div>
              </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8 text-sm text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Quorum. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/markets" className="hover:text-white transition-colors">Markets</Link>
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
            <Link href="/auth" className="hover:text-white transition-colors">Sign In</Link>
          </div>
        </footer>

      </div>
    </div>
  );
}
