'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@meshsdk/react';
import { WalletConnectTerminal } from './WalletConnectTerminal';
import { usePathname } from 'next/navigation';

export function WalletDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { connected, wallet, disconnect } = useWallet();
  const pathname = usePathname();
  const [walletInfo, setWalletInfo] = useState<{
    address: string;
    balance: string;
    assetsCount: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch wallet info when connected
  useEffect(() => {
    async function fetchWalletInfo() {
      if (!wallet || !connected) {
        setWalletInfo(null);
        return;
      }

      try {
        console.log('Getting change address...');
        const address = await wallet.getChangeAddress();
        console.log('Address received:', address, 'Type:', typeof address);

        // Try to get UTxOs with timeout
        let totalLovelace = 0;
        let allAssets = new Set<string>();

        try {
          console.log('Attempting to get UTxOs...');
          const utxosPromise = wallet.getUtxos();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          );

          const utxos = await Promise.race([utxosPromise, timeoutPromise]) as any[];
          console.log('UTxOs received:', utxos.length);

          // Calculate total balance from UTxOs
          utxos.forEach(utxo => {
            utxo.output.amount.forEach(asset => {
              if (asset.unit === 'lovelace') {
                totalLovelace += parseInt(asset.quantity);
              } else {
                allAssets.add(asset.unit);
              }
            });
          });
        } catch (timeoutError) {
          console.warn('getUtxos timed out, showing address only');
          // Just show address with 0 balance if UTxOs fail
        }

        console.log('Setting wallet info:', {
          address,
          balance: totalLovelace / 1_000_000,
          assetsCount: allAssets.size
        });

        setWalletInfo({
          address: address || 'Unknown',
          balance: (totalLovelace / 1_000_000).toFixed(2),
          assetsCount: allAssets.size,
        });
      } catch (error) {
        console.error('Error fetching wallet info:', error);
        console.error('Error details:', error);
      }
    }

    fetchWalletInfo();
  }, [wallet, connected]);

  // Listen for custom refresh events from other components
  useEffect(() => {
    const handleRefreshEvent = () => {
      console.log('🔄 Received refreshWallet event');
      handleRefreshWallet();
    };

    window.addEventListener('refreshWallet', handleRefreshEvent);

    return () => {
      window.removeEventListener('refreshWallet', handleRefreshEvent);
    };
  }, [wallet, connected]);

  // Truncate address for display
  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  // Handle refresh wallet info
  const handleRefreshWallet = async () => {
    setRefreshing(true);
    try {
      if (!wallet || !connected) {
        setRefreshing(false);
        return;
      }

      console.log('Refreshing wallet info...');
      const address = await wallet.getChangeAddress();

      // Get fresh UTxOs
      let totalLovelace = 0;
      let allAssets = new Set<string>();

      try {
        const utxosPromise = wallet.getUtxos();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        );

        const utxos = await Promise.race([utxosPromise, timeoutPromise]) as any[];

        // Calculate total balance from UTxOs
        utxos.forEach(utxo => {
          utxo.output.amount.forEach(asset => {
            if (asset.unit === 'lovelace') {
              totalLovelace += parseInt(asset.quantity);
            } else {
              allAssets.add(asset.unit);
            }
          });
        });
      } catch (timeoutError) {
        console.warn('getUtxos timed out during refresh');
      }

      setWalletInfo({
        address: address || 'Unknown',
        balance: (totalLovelace / 1_000_000).toFixed(2),
        assetsCount: allAssets.size,
      });

      console.log('✅ Wallet info refreshed');
    } catch (err) {
      console.error('Failed to refresh wallet:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      {/* Wallet Button - Fixed Position */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-2 md:left-4 top-4 z-40 px-4 py-2 bg-blue-500/20 backdrop-blur-sm border-2 border-blue-500 text-blue-500 dark:text-blue-400 font-mono font-bold rounded hover:bg-blue-500/30 transition-colors"
      >
        [ WALLET ]
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-xl z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="terminal-header flex items-center justify-between p-4 border-b-2 border-gray-700">
            <span>┌─ WALLET</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold text-xl"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
            {!connected ? (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
                  └─ Connect your wallet to get started
                </div>
                <WalletConnectTerminal />
              </>
            ) : (
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="terminal-box-double">
                  <div className="terminal-header">┌─ STATUS</div>
                  <div className="p-3">
                    <div className="status-ok mb-2">Wallet Connected</div>
                    {walletInfo && (
                      <>
                        <div className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-2">
                          Network: <span className="text-blue-500">Preview</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Wallet Address */}
                {walletInfo && (
                  <div className="terminal-box-double">
                    <div className="terminal-header">┌─ ADDRESS</div>
                    <div className="p-3">
                      <div className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">
                        {walletInfo.address}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(walletInfo.address);
                        }}
                        className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-mono"
                      >
                        [ COPY ]
                      </button>
                    </div>
                  </div>
                )}

                {/* Balance */}
                {walletInfo && (
                  <div className="terminal-box-double">
                    <div className="terminal-header">┌─ BALANCE</div>
                    <div className="p-3">
                      <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
                        {walletInfo.balance} ₳
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1">
                        ADA
                      </div>
                    </div>
                  </div>
                )}

                {/* Assets */}
                {walletInfo && (
                  <div className="terminal-box-double">
                    <div className="terminal-header">┌─ ASSETS</div>
                    <div className="p-3">
                      <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
                        {walletInfo.assetsCount}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1">
                        Tokens & NFTs
                      </div>
                    </div>
                  </div>
                )}

                {/* Refresh and Disconnect Buttons - Side by Side */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleRefreshWallet}
                    disabled={refreshing}
                    className="px-3 py-3 bg-blue-500/20 border-2 border-blue-500 text-blue-500 font-mono font-bold rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {refreshing ? '[ REFRESHING... ]' : '[ REFRESH ]'}
                  </button>

                  <button
                    onClick={() => {
                      disconnect();
                      setIsOpen(false);
                    }}
                    className="px-3 py-3 bg-red-500/20 border-2 border-red-500 text-red-500 font-mono font-bold rounded hover:bg-red-500/30 transition-colors text-sm"
                  >
                    [ DISCONNECT ]
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-600 font-mono text-center">
              └─ BlockVote v0.1.0
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
