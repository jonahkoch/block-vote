'use client';

import { useWallet, useAddress, useAssets } from '@meshsdk/react';
import { useState, useEffect } from 'react';

const WALLETS = [
  { name: 'lace', display: 'Lace', color: 'bg-blue-500 hover:bg-blue-600' },
  { name: 'eternl', display: 'Eternl', color: 'bg-purple-500 hover:bg-purple-600' },
  { name: 'flint', display: 'Flint', color: 'bg-orange-500 hover:bg-orange-600' },
  { name: 'nami', display: 'Nami', color: 'bg-green-500 hover:bg-green-600' },
  { name: 'yoroi', display: 'Yoroi', color: 'bg-indigo-500 hover:bg-indigo-600' },
  { name: 'gerowallet', display: 'Gero', color: 'bg-pink-500 hover:bg-pink-600' },
  { name: 'nufi', display: 'NuFi', color: 'bg-teal-500 hover:bg-teal-600' },
];

export function WalletConnect() {
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
      console.log('Attempting to connect to:', walletName);
      await connect(walletName);
      setWalletName(walletName);
      console.log('Connected successfully!');
    } catch (error) {
      console.error('Connection error:', error);
      alert(`Failed to connect: ${error}`);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setWalletName('');
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center gap-6 p-8 border rounded-lg bg-white dark:bg-gray-900">
        <h2 className="text-2xl font-semibold">Connect Your Wallet</h2>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

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
                className={`px-6 py-3 ${wallet.color} text-white rounded-lg font-semibold transition-colors`}
              >
                {wallet.display}
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
