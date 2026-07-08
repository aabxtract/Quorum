'use client';

import { useEffect, useState } from 'react';

export default function WalletConnect() {
  const [userData, setUserData] = useState<{ stxAddress: string } | null>(null);

  useEffect(() => {
    import('@stacks/connect').then(({ AppConfig, UserSession }) => {
      try {
        const appConfig = new AppConfig(['store_write', 'publish_data']);
        const userSession = new UserSession({ appConfig });
        if (userSession.isUserSignedIn()) {
          try {
            const profile = userSession.loadUserData();
            setUserData({
              stxAddress: profile.profile.stxAddress.testnet || profile.profile.stxAddress.mainnet,
            });
          } catch {
            // Corrupted session data — clear it
            userSession.signUserOut();
          }
        }
      } catch {
        // Clear any stale localStorage data
        localStorage.removeItem('userSession');
      }
    });
  }, []);

  const connectWallet = async () => {
    const { AppConfig, UserSession, showConnect } = await import('@stacks/connect');
    const appConfig = new AppConfig(['store_write', 'publish_data']);
    const userSession = new UserSession({ appConfig });

    showConnect({
      appDetails: { name: 'Quorum', icon: '/favicon.ico' },
      userSession,
      onFinish: () => {
        try {
          const profile = userSession.loadUserData();
          setUserData({
            stxAddress: profile.profile.stxAddress.testnet || profile.profile.stxAddress.mainnet,
          });
        } catch {
          // Session data still corrupted after connect — reload
          window.location.reload();
        }
      },
      onCancel: () => {},
    });
  };

  const disconnectWallet = async () => {
    const { AppConfig, UserSession } = await import('@stacks/connect');
    const appConfig = new AppConfig(['store_write', 'publish_data']);
    const userSession = new UserSession({ appConfig });
    userSession.signUserOut('/');
    setUserData(null);
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="flex items-center gap-3">
      {userData ? (
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm font-mono text-gray-300">
            {truncateAddress(userData.stxAddress)}
          </span>
          <button
            onClick={disconnectWallet}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="px-4 py-2 bg-quorum-500 hover:bg-quorum-400 text-surface-dark font-semibold rounded-lg text-sm transition-all"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}
