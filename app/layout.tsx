import type { Metadata } from 'next';
import { Poppins, Open_Sans } from 'next/font/google';
import './globals.css';
import Nav from './nav';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-open-sans',
});

export const metadata: Metadata = {
  title: 'Quorum — AI-Resolved Crypto Prediction Market',
  description: 'Stake your conviction. The agent resolves it. FlowVault pays. Permissionless crypto prediction markets on Stacks with atomic trustless settlement.',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'Quorum — AI-Resolved Crypto Prediction Market',
    description: 'Stake your conviction. The agent resolves it. FlowVault pays.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className={`min-h-screen bg-[#0f0f11] text-gray-100 antialiased ${poppins.variable} ${openSans.variable} font-sans flex flex-col`}>
        <Nav />
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  );
}
