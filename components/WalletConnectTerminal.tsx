'use client';

import { useWallet, useAddress, useAssets } from '@meshsdk/react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const WALLETS = [
  { name: 'lace', display: 'lace' },
  { name: 'eternl', display: 'eternl' },
  { name: 'flint', display: 'flint' },
  { name: 'nami', display: 'nami' },
  { name: 'yoroi', display: 'yoroi' },
  { name: 'gerowallet', display: 'gero' },
  { name: 'nufi', display: 'nufi' },
];

export function WalletConnectTerminal() {
  const { theme } = useTheme();
  const { connect, connected, disconnect } = useWallet();
  const address = useAddress();
  const assets = useAssets();
  const [mounted, setMounted] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);

    // Detect available wallets
    if (typeof window !== 'undefined' && window.cardano) {
      const detected: string[] = [];
      Object.keys(window.cardano).forEach((key) => {
        if (key !== 'undefined' && window.cardano[key]?.enable) {
          detected.push(key);
        }
      });
      setAvailableWallets(detected);
    }
  }, []);

  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName);
      setWalletName(walletName);
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setWalletName('');
  };

  if (!mounted) {
    return (
      <div className="terminal-box">
        <div>LOADING...</div>
      </div>
    );
  }

  if (theme === 'terminal') {
    // Terminal theme rendering
    return (
      <div className="terminal-box-double" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="terminal-header">
          ┌─ WALLET CONNECTION
        </div>

        {!connected ? (
          <div>
            <div style={{ marginBottom: '1rem', color: 'var(--terminal-dim)' }}>
              SELECT CARDANO WALLET:
            </div>
            <div>
              {WALLETS.filter(w => availableWallets.includes(w.name)).map((wallet, idx) => (
                <div
                  key={wallet.name}
                  className="terminal-list-item"
                  onClick={() => handleConnect(wallet.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {wallet.display}
                </div>
              ))}
            </div>
            {availableWallets.length === 0 && (
              <div style={{ marginTop: '1rem', color: 'var(--terminal-highlight)' }}>
                [!] NO WALLETS DETECTED
              </div>
            )}
            <div style={{ marginTop: '1rem', fontSize: '12px', color: 'var(--terminal-dim)' }}>
              └─ NETWORK: PREVIEW TESTNET
            </div>
          </div>
        ) : (
          <div>
            <div className="terminal-connected" style={{ marginBottom: '1rem' }}>
              {walletName.toUpperCase()}
            </div>

            {address && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: 'var(--terminal-dim)', marginBottom: '0.5rem' }}>
                  ADDRESS:
                </div>
                <div className="terminal-address">
                  {address}
                </div>
              </div>
            )}

            {assets && (
              <div style={{ marginBottom: '1rem', color: 'var(--terminal-dim)' }}>
                ASSETS: {assets.length}
              </div>
            )}

            <div
              onClick={handleDisconnect}
              className="terminal-list-item"
              style={{ cursor: 'pointer', marginTop: '1.5rem' }}
            >
              [ DISCONNECT ]
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default theme rendering (keep original colorful design)
  return (
    <div className="flex flex-col gap-4 p-8 border rounded-lg bg-white dark:bg-gray-900 w-full">
      <h2 className="text-2xl font-semibold text-center">Connect Your Wallet</h2>

      {!connected ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
            Select your Cardano wallet to connect:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {WALLETS.filter(w => availableWallets.includes(w.name)).map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleConnect(wallet.name)}
                className={`px-6 py-3 ${
                  wallet.name === 'lace' ? 'bg-blue-500 hover:bg-blue-600' :
                  wallet.name === 'eternl' ? 'bg-purple-500 hover:bg-purple-600' :
                  wallet.name === 'flint' ? 'bg-orange-500 hover:bg-orange-600' :
                  wallet.name === 'nami' ? 'bg-green-500 hover:bg-green-600' :
                  wallet.name === 'yoroi' ? 'bg-indigo-500 hover:bg-indigo-600' :
                  wallet.name === 'gerowallet' ? 'bg-pink-500 hover:bg-pink-600' :
                  'bg-teal-500 hover:bg-teal-600'
                } text-white rounded-lg font-semibold transition-colors`}
              >
                {wallet.display.charAt(0).toUpperCase() + wallet.display.slice(1)}
              </button>
            ))}
          </div>
          {availableWallets.length === 0 && (
            <p className="text-red-600 dark:text-red-400 text-sm text-center mt-2">
              No wallets detected. Please install a Cardano wallet extension.
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-2">
            Make sure your wallet is set to <strong>Preview Testnet</strong>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-green-700 dark:text-green-400 font-semibold flex items-center gap-2">
              <span className="text-2xl">✓</span>
              Connected to {walletName.charAt(0).toUpperCase() + walletName.slice(1)}
            </p>
          </div>

          {address && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Address:</p>
              <p className="text-gray-600 dark:text-gray-400 font-mono text-xs break-all">
                {address}
              </p>
            </div>
          )}

          {assets && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                Assets in wallet: {assets.length}
              </p>
            </div>
          )}

          <button
            onClick={handleDisconnect}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold transition-colors"
          >
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
}
