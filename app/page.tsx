'use client';
import Link from 'next/link';
import useSWR from 'swr';
import MarketCard, { Market } from '@/components/MarketCard';
import AgentFeed from '@/components/AgentFeed';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const faqs = [
  { q: 'How does the AI resolution work?', a: 'An autonomous agent powered by Llama 3.3 70B constantly monitors open markets. Once the resolution time is reached, it fetches the price from Binance public API, evaluates the target condition, and immediately decides the winner.' },
  { q: 'How is settlement trustless?', a: 'FlowVault enforces atomic settlement on the Stacks testnet. The agent can only execute a 4-step atomic cycle: clear rules, set split for winners + protocol lock, deposit the pool, clear rules. Stale rules are impossible.' },
  { q: 'What is FlowVault?', a: 'FlowVault is a non-custodial smart contract primitive on Stacks. We use it to Hold stakes, Split winner payouts, and Lock protocol reserves — all in one atomic transaction without manual claiming.' },
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
      
      {/* Hero Vertical Gradient Streaks (matching image background) */}
      <div className="absolute top-0 inset-x-0 h-[800px] pointer-events-none flex justify-center opacity-40">
        <div className="w-[1px] h-full bg-gradient-to-b from-quorum-500/0 via-quorum-500/20 to-transparent mx-8"></div>
        <div className="w-[1px] h-full bg-gradient-to-b from-quorum-500/0 via-quorum-500/40 to-transparent mx-8"></div>
        <div className="w-[1px] h-full bg-gradient-to-b from-quorum-500/0 via-quorum-500/20 to-transparent mx-8"></div>
        <div className="w-[1px] h-full bg-gradient-to-b from-quorum-500/0 via-quorum-500/10 to-transparent mx-8"></div>
      </div>
      
      {/* Top large soft glow */}
      <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[60%] h-[500px] bg-quorum-500/10 blur-[150px] rounded-[100%] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-40 pb-24 relative z-10">
        
        {/* ─── HERO SECTION ────────────────────────────── */}
        <section className="text-center max-w-4xl mx-auto mb-32 flex flex-col items-center">
          
          <div className="inline-flex items-center px-5 py-2 rounded-full border border-white/10 bg-white/5 text-gray-300 text-xs font-semibold tracking-[0.2em] uppercase mb-8 backdrop-blur-sm">
            ABOUT QUORUM
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-white mb-6">
            Stake Your Conviction.<br />
            The Agent Resolves It.
          </h1>
          
          <p className="text-base md:text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            At Quorum, we empower traders worldwide by offering permissionless, fast, and trustless prediction markets. FlowVault settles every dollar on-chain atomically.
          </p>
          
          <Link
            href="/auth"
            className="px-8 py-3.5 bg-white hover:bg-gray-100 text-[#0A0A0B] font-bold rounded-full transition-all text-sm"
          >
            Get Started Today
          </Link>
        </section>

        {/* ─── 2 LARGE CARDS (LIKE THE IMAGE) ──────────── */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Card: Flash Markets */}
            <div className="group relative bg-[#121214] rounded-3xl p-8 overflow-hidden border border-white/5 hover:border-white/10 transition-colors">
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-[url('/dot-grid.svg')] bg-[length:24px_24px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
              <div className="absolute top-[-50px] left-[-50px] w-[200px] h-[200px] bg-quorum-500/20 blur-[80px] rounded-full pointer-events-none group-hover:bg-quorum-500/30 transition-all"></div>
              
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-16 shadow-[0_0_15px_rgba(12,242,196,0.2)]">
                  <span className="text-quorum-500 text-xl">⚡</span>
                </div>
                <h3 className="text-white font-bold text-xl mb-3">Flash Markets</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Our mission is simple — to provide traders with the fastest resolution times possible. 
                  Flash markets resolve in 5 to 60 minutes. We believe in transparency and giving every trader a real chance to capitalize on immediate price action.
                </p>
              </div>
            </div>

            {/* Right Card: Position Markets */}
            <div className="group relative bg-[#121214] rounded-3xl p-8 overflow-hidden border border-white/5 hover:border-white/10 transition-colors">
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-[url('/dot-grid.svg')] bg-[length:24px_24px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>
              <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-orange-500/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-all"></div>
              
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-16 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                  <span className="text-orange-400 text-xl">📊</span>
                </div>
                <h3 className="text-white font-bold text-xl mb-3">Position Markets</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We envision a world where trading is accessible, trustworthy, and rewarding for all. 
                  Position markets run for hours or days, allowing you to build strong directional convictions based on macro trends rather than just micro volatility.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ─── 3 SMALL CARDS (Why Traders Choose...) ───── */}
        <section className="mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-2">Why Traders Choose</h2>
            <h2 className="text-3xl font-black text-white uppercase">QUORUM</h2>
          </div>

          <div className="bg-[#121214]/50 rounded-3xl p-6 border border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-[#18181B] rounded-2xl p-6 border border-white/5 hover:bg-[#1A1A1E] transition-colors">
                <div className="w-8 h-8 rounded-full bg-quorum-500/10 flex items-center justify-center mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-quorum-500 glow-cyan"></div>
                </div>
                <h3 className="text-white font-bold text-base mb-2">Transparent Trading Conditions</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  No hidden fees, no surprises. Just clear, fair terms. FlowVault enforces exactly what was agreed.
                </p>
              </div>
              
              <div className="bg-[#18181B] rounded-2xl p-6 border border-white/5 hover:bg-[#1A1A1E] transition-colors">
                <div className="w-8 h-8 rounded-full bg-quorum-500/10 flex items-center justify-center mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-quorum-500 glow-cyan"></div>
                </div>
                <h3 className="text-white font-bold text-base mb-2">Instant Atomic Settlement</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Unlock your payouts faster. The moment the AI resolves the market, FlowVault distributes the proceeds directly to your wallet.
                </p>
              </div>
              
              <div className="bg-[#18181B] rounded-2xl p-6 border border-white/5 hover:bg-[#1A1A1E] transition-colors">
                <div className="w-8 h-8 rounded-full bg-quorum-500/10 flex items-center justify-center mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-quorum-500 glow-cyan"></div>
                </div>
                <h3 className="text-white font-bold text-base mb-2">Autonomous AI Oracle</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Get reliable, fast resolution from an unbiased Llama 3.3 agent that reads public data, rather than relying on human dispute layers.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ─── LIVE MARKETS (App integration) ──────────── */}
        <section id="markets" className="mb-32">
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
        </section>

        {/* FAQs */}
        <section id="faq" className="max-w-3xl mx-auto border-t border-white/10 pt-20">
          <h2 className="text-3xl font-black text-white mb-10 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
