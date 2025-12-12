'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@meshsdk/react';
import {
  checkPactEligibility,
  isBlockfrostConfigured,
  type PactEligibility,
} from '@/lib/query-drep';
import { hasPactToken } from '@/lib/query-pact-token';

interface ClaimPactDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClaimPactDrawer({ isOpen, onClose }: ClaimPactDrawerProps) {
  const { wallet, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<PactEligibility | null>(null);
  const [hasPact, setHasPact] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [stakeAddress, setStakeAddress] = useState<string>('');

  // Load wallet and eligibility data
  useEffect(() => {
    if (!isOpen || !connected || !wallet) return;

    const loadData = async () => {
      setLoading(true);

      try {
        // Get wallet addresses
        const address = await wallet.getChangeAddress();
        setWalletAddress(address);

        const rewardAddresses = await wallet.getRewardAddresses();
        if (rewardAddresses && rewardAddresses.length > 0) {
          setStakeAddress(rewardAddresses[0]);
        }

        // Check eligibility
        if (isBlockfrostConfigured()) {
          console.log('Checking PACT eligibility...');
          const eligibilityResult = await checkPactEligibility(wallet);
          setEligibility(eligibilityResult);
          console.log('Eligibility result:', eligibilityResult);
        } else {
          console.warn('Blockfrost not configured');
        }

        // Check if user has PACT token
        const pactStatus = await hasPactToken(wallet);
        setHasPact(pactStatus);
      } catch (error) {
        console.error('Failed to load PACT drawer data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, connected, wallet]);

  const handleClaimPact = async () => {
    if (!wallet || !eligibility?.isEligible) return;

    try {
      setLoading(true);
      console.log('Starting PACT token claim...');

      // Import the transaction builder
      const { buildClaimPactTx } = await import('@/lib/transactions-pact');

      // Build and submit the transaction
      const result = await buildClaimPactTx(wallet, walletAddress);

      console.log('PACT claim successful:', result);

      // Refresh the drawer to show the new PACT token
      const pactStatus = await hasPactToken(wallet);
      setHasPact(pactStatus);

      alert(`✅ PACT token claimed successfully!\n\nTransaction: ${result.txHash}`);
    } catch (error) {
      console.error('Failed to claim PACT token:', error);
      alert(`❌ Failed to claim PACT token:\n\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBurnPact = async () => {
    if (!wallet || !hasPact) return;

    // Confirm before burning
    const confirmed = confirm(
      '⚠️ Are you sure you want to burn your PACT token?\n\n' +
      'This will:\n' +
      '• Burn (destroy) your PACT membership NFT\n' +
      '• Return 9 ADA to your wallet\n' +
      '• Remove your ability to claim voting tokens\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      console.log('Starting PACT token burn...');

      // Import the burn transaction builder
      const { buildBurnPactTx } = await import('@/lib/transactions-pact');

      // Build and submit the burn transaction
      const result = await buildBurnPactTx(wallet, walletAddress);

      console.log('PACT burn successful:', result);

      // Refresh the drawer to show the token is gone
      const pactStatus = await hasPactToken(wallet);
      setHasPact(pactStatus);

      alert(`✅ PACT token burned successfully!\n\n9 ADA returned to your wallet\n\nTransaction: ${result.txHash}`);
    } catch (error) {
      console.error('Failed to burn PACT token:', error);
      alert(`❌ Failed to burn PACT token:\n\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer - Right Side */}
      <div
        className={`fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-xl z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="terminal-header flex items-center justify-between p-4 border-b-2 border-gray-700">
            <span>┌─ CLAIM PACT</span>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold text-xl"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
            {!connected ? (
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
                └─ Connect your wallet first
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400 font-mono text-sm">
                  Loading...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Payment Address */}
                <div className="terminal-box-double">
                  <div className="terminal-header">┌─ PAYMENT ADDRESS</div>
                  <div className="p-3">
                    <div className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">
                      {walletAddress}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddress);
                      }}
                      className="mt-2 text-xs text-purple-500 hover:text-purple-700 font-mono"
                    >
                      [ COPY ]
                    </button>
                  </div>
                </div>

                {/* Stake Address */}
                <div className="terminal-box-double">
                  <div className="terminal-header">┌─ STAKE ADDRESS</div>
                  <div className="p-3">
                    <div className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">
                      {stakeAddress || 'Not available'}
                    </div>
                    {stakeAddress && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(stakeAddress);
                        }}
                        className="mt-2 text-xs text-purple-500 hover:text-purple-700 font-mono"
                      >
                        [ COPY ]
                      </button>
                    )}
                  </div>
                </div>

                {/* DRep ID */}
                {eligibility?.drepId && (
                  <div className="terminal-box-double">
                    <div className="terminal-header">┌─ DREP ID</div>
                    <div className="p-3">
                      <div className="text-xs font-mono break-all text-gray-700 dark:text-gray-300 mb-2">
                        {eligibility.drepId}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(eligibility.drepId!);
                          }}
                          className="text-xs text-purple-500 hover:text-purple-700 font-mono"
                        >
                          [ COPY ]
                        </button>
                        {eligibility.drepIdCip105 && eligibility.drepIdCip105 !== eligibility.drepId && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(eligibility.drepIdCip105!);
                            }}
                            className="text-xs text-purple-500 hover:text-purple-700 font-mono"
                          >
                            [ COPY CIP-105 ]
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* DRep Status */}
                {eligibility && (
                  <div className="terminal-box-double">
                    <div className="terminal-header">┌─ DREP STATUS</div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-gray-600 dark:text-gray-400">Registration:</span>
                        <span
                          className={`font-bold ${
                            eligibility.isDRep
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {eligibility.isDRep ? '✓ ACTIVE' : '✗ INACTIVE'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-gray-600 dark:text-gray-400">Delegation:</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          {eligibility.delegationAda.toFixed(2)} ₳
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Eligibility Thresholds */}
                {eligibility && (
                  <div className="terminal-box-double">
                    <div className="terminal-header">┌─ ELIGIBILITY</div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-gray-600 dark:text-gray-400">
                          Delegation {'<'} 13M ₳:
                        </span>
                        <span
                          className={`font-bold ${
                            eligibility.passesDelegationThreshold
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {eligibility.passesDelegationThreshold ? '✓ PASS' : '✗ FAIL'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-gray-600 dark:text-gray-400">Balance ≥ 10 ₳:</span>
                        <span
                          className={`font-bold ${
                            eligibility.hasMinimumBalance
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {eligibility.hasMinimumBalance ? '✓ PASS' : '✗ FAIL'}
                        </span>
                      </div>

                      {!eligibility.isEligible && eligibility.reason && (
                        <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-700 rounded">
                          <p className="text-xs font-mono text-yellow-800 dark:text-yellow-400">
                            {eligibility.reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PACT Token Status */}
                <div className="terminal-box-double">
                  <div className="terminal-header">┌─ PACT TOKEN</div>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3 text-sm font-mono">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span
                        className={`font-bold ${
                          hasPact
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {hasPact ? '✓ CLAIMED' : '✗ NOT CLAIMED'}
                      </span>
                    </div>

                    {!hasPact && (
                      <>
                        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-700 rounded">
                          <p className="text-xs font-mono text-blue-800 dark:text-blue-400">
                            <strong>Cost:</strong> 10 ₳
                          </p>
                          <p className="text-xs font-mono text-blue-800 dark:text-blue-400 mt-1">
                            Required to claim voting tokens
                          </p>
                        </div>

                        <button
                          onClick={handleClaimPact}
                          disabled={!eligibility?.isEligible}
                          className={`w-full px-4 py-3 font-mono font-bold rounded transition-colors ${
                            eligibility?.isEligible
                              ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-500 hover:bg-purple-500/30'
                              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 border-2 border-gray-400 dark:border-gray-600 cursor-not-allowed'
                          }`}
                        >
                          {eligibility?.isEligible ? '[ CLAIM - 10 ₳ ]' : '[ INELIGIBLE ]'}
                        </button>
                      </>
                    )}

                    {hasPact && (
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-700 rounded">
                        <p className="text-xs font-mono text-green-800 dark:text-green-400">
                          ✓ You can claim voting tokens
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Burn & Redeem Section */}
                {hasPact && (
                  <div className="terminal-box-double">
                    <div className="terminal-header">┌─ BURN & REDEEM</div>
                    <div className="p-3">
                      <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-400 dark:border-orange-700 rounded">
                        <p className="text-xs font-mono text-orange-800 dark:text-orange-400">
                          <strong>Redeem:</strong> 9 ₳
                        </p>
                        <p className="text-xs font-mono text-orange-800 dark:text-orange-400 mt-1">
                          Burn your PACT token to get 9 ADA back
                        </p>
                      </div>

                      <button
                        onClick={handleBurnPact}
                        disabled={loading}
                        className="w-full px-4 py-3 font-mono font-bold rounded transition-colors bg-orange-500/20 border-2 border-orange-500 text-orange-500 hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? '[ PROCESSING... ]' : '[ BURN & REDEEM - 9 ₳ ]'}
                      </button>

                      <p className="text-xs font-mono text-gray-500 dark:text-gray-600 mt-2 text-center">
                        ⚠️ This action cannot be undone
                      </p>
                    </div>
                  </div>
                )}

                {!isBlockfrostConfigured() && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-700 rounded">
                    <p className="text-xs font-mono text-red-800 dark:text-red-400">
                      Blockfrost API not configured
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-600 font-mono text-center">
              └─ Membership Token System
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
