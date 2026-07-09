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

      {/* ─── AURORA LIGHT BEAMS ──────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 h-[700px] pointer-events-none overflow-hidden">

        {/* Left cluster — cyan/teal beams */}
        <div className="absolute top-0 left-[12%] w-[2px] h-full bg-gradient-to-b from-quorum-500/60 via-quorum-500/20 to-transparent blur-[1px]" />
        <div className="absolute top-0 left-[15%] w-[80px] h-[85%] bg-gradient-to-b from-quorum-500/25 via-quorum-500/8 to-transparent blur-[40px]" />
        <div className="absolute top-0 left-[18%] w-[1px] h-[70%] bg-gradient-to-b from-quorum-500/40 via-quorum-500/10 to-transparent blur-[0.5px]" />
        <div className="absolute top-0 left-[20%] w-[120px] h-full bg-gradient-to-b from-quorum-500/15 via-quorum-500/5 to-transparent blur-[60px]" />

        {/* Right cluster — orange/red beams */}
        <div className="absolute top-0 right-[12%] w-[2px] h-full bg-gradient-to-b from-orange-500/60 via-orange-500/20 to-transparent blur-[1px]" />
        <div className="absolute top-0 right-[15%] w-[80px] h-[85%] bg-gradient-to-b from-orange-500/25 via-orange-500/8 to-transparent blur-[40px]" />
        <div className="absolute top-0 right-[18%] w-[1px] h-[70%] bg-gradient-to-b from-orange-500/40 via-orange-500/10 to-transparent blur-[0.5px]" />
        <div className="absolute top-0 right-[20%] w-[120px] h-full bg-gradient-to-b from-orange-500/15 via-orange-500/5 to-transparent blur-[60px]" />

        {/* Centre glow pool at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-quorum-500/[0.06] blur-[100px] rounded-full" />

        {/* Hard floor fade */}
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-[#0A0A0B] to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-44 pb-24 relative z-10">

        {/* ─── HERO SECTION ────────────────────────────── */}
        <section className="text-center max-w-4xl mx-auto mb-32 flex flex-col items-center">

          {/* Pill label */}
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-quorum-500/30 bg-quorum-500/[0.07] text-quorum-500 text-xs font-semibold tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-quorum-500 animate-pulse" />
            AI-Resolved · On-Chain Settlement
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.08] text-white mb-6">
            Predict the Price.<br />
            Get Paid Instantly.
          </h1>

          <p className="text-base md:text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Call it right and FlowVault sends your winnings straight to your wallet — no middlemen, no delays, no trust required. The AI checks the result. The blockchain handles the rest.
          </p>

          <Link
            href="/auth"
            className="px-8 py-3.5 bg-white hover:bg-gray-100 text-[#0A0A0B] font-bold rounded-full transition-all text-sm"
          >
            Start Trading Now
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
                <h3 className="text-white font-bold text-base mb-2">No Hidden Rules</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Every market shows you the exact condition, target price, and deadline before you stake a cent. What you see is what the AI resolves.
                </p>
              </div>
              
              <div className="bg-[#18181B] rounded-2xl p-6 border border-white/5 hover:bg-[#1A1A1E] transition-colors">
                <div className="w-8 h-8 rounded-full bg-quorum-500/10 flex items-center justify-center mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-quorum-500 glow-cyan"></div>
                </div>
                <h3 className="text-white font-bold text-base mb-2">Winnings Go Straight to Your Wallet</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  The moment the AI resolves a market, FlowVault sends your payout directly on-chain. No claiming, no waiting, no approval needed.
                </p>
              </div>
              
              <div className="bg-[#18181B] rounded-2xl p-6 border border-white/5 hover:bg-[#1A1A1E] transition-colors">
                <div className="w-8 h-8 rounded-full bg-quorum-500/10 flex items-center justify-center mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-quorum-500 glow-cyan"></div>
                </div>
                <h3 className="text-white font-bold text-base mb-2">Zero Human Interference</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  An autonomous AI agent reads live price data and resolves every market automatically. No admin can override it, delay it, or change the outcome.
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
