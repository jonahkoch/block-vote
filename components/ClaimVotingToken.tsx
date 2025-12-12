'use client';

import { useState, useEffect } from 'react';
import { useWallet, useAddress } from '@meshsdk/react';

interface ClaimVotingTokenProps {
  governanceActionId: string;
  policyId: string;
  fractionTokenName: string;
  authorizedMembers: string[]; // List of stake addresses
  alreadyClaimed: string[]; // List of stake addresses that already claimed
}

export function ClaimVotingToken({
  governanceActionId,
  policyId,
  fractionTokenName,
  authorizedMembers,
  alreadyClaimed,
}: ClaimVotingTokenProps) {
  const { wallet, connected } = useWallet();
  const walletAddress = useAddress();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [stakeAddress, setStakeAddress] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (connected && walletAddress) {
      checkEligibility();
    } else {
      setChecking(false);
    }
  }, [connected, walletAddress, authorizedMembers, alreadyClaimed]);

  const checkEligibility = async () => {
    setChecking(true);
    setError(null);

    try {
      // TODO: Get stake address from wallet
      // For now, mock it
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock stake address extraction
      const mockStakeAddress = 'stake_test1uzpq2pktpnj4dzh4c2qkc0jz9gxtej3ezm0z6k8z5z5z5z';
      setStakeAddress(mockStakeAddress);

      // Check if authorized
      const authorized = authorizedMembers.includes(mockStakeAddress);
      setIsAuthorized(authorized);

      // Check if already claimed
      const claimed = alreadyClaimed.includes(mockStakeAddress);
      setHasClaimed(claimed);

    } catch (err) {
      console.error('Failed to check eligibility:', err);
      setError('Failed to verify eligibility');
    } finally {
      setChecking(false);
    }
  };

  const handleClaim = async () => {
    if (!connected || !wallet) {
      setError('Please connect your wallet');
      return;
    }

    if (!isAuthorized) {
      setError('You are not authorized to claim a voting token for this governance action');
      return;
    }

    if (hasClaimed) {
      setError('You have already claimed your voting token');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Starting claim token transaction...');

      // 1. Query Distribution Validator UTxO for this governance pact
      const { queryDistributionUtxoForPact, decodeDistributionDatum } = await import('@/lib/query-pacts');

      console.log('Querying Distribution Validator UTxO...');
      console.log('Policy ID:', policyId);
      console.log('Token Name:', fractionTokenName);

      const distributionUtxo = await queryDistributionUtxoForPact(policyId, fractionTokenName);

      if (!distributionUtxo) {
        throw new Error('Distribution UTxO not found. No tokens available to claim.');
      }

      console.log('Found Distribution UTxO:', distributionUtxo);

      // 2. Decode the distribution datum
      const decodedDatum = await decodeDistributionDatum(distributionUtxo.datum);

      if (!decodedDatum) {
        throw new Error('Failed to decode distribution datum');
      }

      console.log('Decoded datum:', decodedDatum);

      // 3. Build and submit claim transaction
      const { buildClaimTokenTx } = await import('@/lib/transactions-lucid');

      console.log('Building claim transaction...');
      const result = await buildClaimTokenTx(wallet, {
        userAddress: walletAddress,
        policyId: policyId,
        userTokenName: fractionTokenName,
        distributionUtxoTxHash: distributionUtxo.txHash,
        distributionUtxoIndex: distributionUtxo.outputIndex,
        distributionDatum: decodedDatum,
      });

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      console.log('✅ Claim successful:', result.txHash);
      setSuccess(`Successfully claimed voting token! Transaction ID: ${result.txHash}`);
      setHasClaimed(true);

    } catch (err) {
      console.error('Claim transaction failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim voting token. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="terminal-box">
        <div className="terminal-header">┌─ CLAIM VOTING TOKEN</div>
        <div className="p-4">
          <div className="bg-yellow-500/10 border border-yellow-500 rounded p-4 text-center font-mono text-sm">
            ⚠ Please connect your wallet to claim voting token
          </div>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="terminal-box">
        <div className="terminal-header">┌─ CLAIM VOTING TOKEN</div>
        <div className="p-4">
          <div className="text-center text-gray-500 font-mono animate-pulse">
            Checking eligibility...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-box">
      <div className="terminal-header">┌─ CLAIM VOTING TOKEN</div>
      <div className="p-4 space-y-4">
        {/* Eligibility Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-mono">
            <span className="text-gray-500">Your stake address:</span>
            <span className="text-xs break-all">{stakeAddress || 'Unknown'}</span>
          </div>

          <div className={`flex items-center gap-2 text-sm font-mono ${
            isAuthorized ? 'text-green-500' : 'text-red-500'
          }`}>
            {isAuthorized ? '✓' : '✗'}
            {isAuthorized ? 'You are authorized to vote' : 'You are not authorized to vote'}
          </div>

          {isAuthorized && (
            <div className={`flex items-center gap-2 text-sm font-mono ${
              hasClaimed ? 'text-yellow-500' : 'text-green-500'
            }`}>
              {hasClaimed ? '✓' : '→'}
              {hasClaimed ? 'Token already claimed' : 'Ready to claim token'}
            </div>
          )}
        </div>

        {/* Requirements Info */}
        {!isAuthorized && (
          <div className="bg-red-500/10 border border-red-500 rounded p-3 text-xs font-mono space-y-1">
            <p className="font-bold">You do not meet the requirements:</p>
            <p>→ Must be an active DRep</p>
            <p>→ Must hold required policy ID token</p>
            <p>→ Must be included in authorized members list</p>
          </div>
        )}

        {/* Already Claimed Info */}
        {isAuthorized && hasClaimed && (
          <div className="bg-green-500/10 border border-green-500 rounded p-3 text-xs font-mono">
            ✓ You have already claimed your voting token. You can now cast your vote.
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded p-3 text-sm font-mono">
            ✗ {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-500/10 border border-green-500 rounded p-3 text-sm font-mono overflow-x-auto">
            <div className="break-words">✓ {success}</div>
          </div>
        )}

        {/* Claim Button */}
        <button
          onClick={handleClaim}
          disabled={loading || !isAuthorized || hasClaimed}
          className="w-full px-4 py-3 bg-green-500 text-black font-mono font-bold rounded hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'CLAIMING...' : hasClaimed ? 'ALREADY CLAIMED' : 'CLAIM VOTING TOKEN'}
        </button>

        {/* Token Info */}
        <div className="text-xs text-gray-500 font-mono space-y-1 border-t border-gray-700 pt-4">
          <p>→ Each member receives exactly 1 voting token</p>
          <p>→ Token represents your voting power</p>
          <p>→ Cast vote by sending token to Voting Validator</p>
          <p>→ Claiming is free (you only pay transaction fees)</p>
        </div>
      </div>
    </div>
  );
}
