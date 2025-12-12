'use client';

import { useState, useEffect } from 'react';
import { useWallet, useAssets } from '@meshsdk/react';

interface CastVoteProps {
  governanceActionId: string;
  policyId: string;
  fractionTokenName: string;
  votingDeadline: number; // POSIX timestamp
  currentVotes: number;
  requiredVotes: number;
  totalMembers: number;
}

export function CastVote({
  governanceActionId,
  policyId,
  fractionTokenName,
  votingDeadline,
  currentVotes,
  requiredVotes,
  totalMembers,
}: CastVoteProps) {
  const { wallet, connected } = useWallet();
  const assets = useAssets();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasVotingToken, setHasVotingToken] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [voteChoice, setVoteChoice] = useState<'Yes' | 'No' | null>(null);

  useEffect(() => {
    if (connected && assets) {
      checkVotingTokenOwnership();
    } else {
      setChecking(false);
    }
  }, [connected, assets, policyId, fractionTokenName]);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const diff = votingDeadline - now;

      if (diff <= 0) {
        setTimeRemaining('VOTING ENDED');
      } else {
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${seconds}s`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [votingDeadline]);

  const checkVotingTokenOwnership = async () => {
    setChecking(true);
    setError(null);

    try {
      // TODO: Check if wallet holds the voting token
      // Token unit = policyId + fractionTokenName
      const tokenUnit = `${policyId}${fractionTokenName}`;

      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock check
      const hasToken = assets?.some(asset => asset.unit === tokenUnit) || false;
      setHasVotingToken(hasToken);

      // TODO: Check if token has been sent to Voting Validator
      // (i.e., user has already voted)
      setHasVoted(false);

    } catch (err) {
      console.error('Failed to check token ownership:', err);
      setError('Failed to verify token ownership');
    } finally {
      setChecking(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger wallet refresh via custom event
      window.dispatchEvent(new CustomEvent('refreshWallet'));

      // Wait a moment for wallet to refresh
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Re-check token ownership
      await checkVotingTokenOwnership();

      console.log('✅ Voting status refreshed');
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleVote = async () => {
    if (!connected || !wallet) {
      setError('Please connect your wallet');
      return;
    }

    if (!hasVotingToken) {
      setError('You do not have a voting token. Please claim one first.');
      return;
    }

    if (hasVoted) {
      setError('You have already cast your vote');
      return;
    }

    if (Date.now() > votingDeadline) {
      setError('Voting period has ended');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Starting cast vote transaction...');
      console.log('Vote choice:', voteChoice);

      // Get user's wallet address
      const walletAddress = (await wallet.getUsedAddresses())[0];

      // Build and submit vote transaction
      const { buildCastVoteTx } = await import('@/lib/transactions-lucid');

      console.log('Building vote transaction...');
      const result = await buildCastVoteTx(wallet, {
        userAddress: walletAddress,
        policyId: policyId,
        userTokenName: fractionTokenName,
        vote: voteChoice,
      });

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      console.log('✅ Vote cast successful:', result.txHash);
      setSuccess(`Vote cast successfully (${voteChoice})! Transaction ID: ${result.txHash}`);
      setHasVoted(true);
      setHasVotingToken(false);

    } catch (err) {
      console.error('Vote transaction failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to cast vote. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isVotingEnded = Date.now() > votingDeadline;
  const voteProgress = Math.min((currentVotes / requiredVotes) * 100, 100);
  const willPass = currentVotes >= requiredVotes;

  if (!connected) {
    return (
      <div className="terminal-box">
        <div className="terminal-header flex items-center justify-between">
          <span>┌─ CAST YOUR VOTE</span>
        </div>
        <div className="p-4">
          <div className="bg-yellow-500/10 border border-yellow-500 rounded p-4 text-center font-mono text-sm">
            ⚠ Please connect your wallet to cast your vote
          </div>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="terminal-box">
        <div className="terminal-header flex items-center justify-between">
          <span>┌─ CAST YOUR VOTE</span>
        </div>
        <div className="p-4">
          <div className="text-center text-gray-500 font-mono animate-pulse">
            Checking voting token...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-box">
      <div className="terminal-header flex items-center justify-between">
        <span>┌─ CAST YOUR VOTE</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || checking}
          className="px-3 py-1 bg-blue-500/20 border border-blue-500 text-blue-500 font-mono text-xs font-bold rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? 'REFRESHING...' : '↻ REFRESH'}
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Vote Status */}
        <div className="grid grid-cols-2 gap-4 text-sm font-mono">
          <div className="space-y-1">
            <div className="text-gray-500">Current Votes</div>
            <div className="text-2xl font-bold">
              {currentVotes} / {requiredVotes}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-500">Time Remaining</div>
            <div className={`text-2xl font-bold ${isVotingEnded ? 'text-red-500' : 'text-green-500'}`}>
              {timeRemaining}
            </div>
          </div>
        </div>

        {/* Vote Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-mono">
            <span>Progress to Threshold</span>
            <span className="text-gray-500">{Math.round(voteProgress)}%</span>
          </div>
          <div className="h-3 bg-gray-800 rounded overflow-hidden">
            <div
              className={`h-full transition-all ${
                willPass ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${voteProgress}%` }}
            />
          </div>
          {willPass && (
            <div className="text-xs font-mono text-green-500">
              ✓ Threshold reached! This governance action will be APPROVED
            </div>
          )}
        </div>

        {/* Voting Token Status */}
        <div className="border-t border-gray-700 pt-4">
          <div className={`flex items-center gap-2 text-sm font-mono mb-2 ${
            hasVotingToken ? 'text-green-500' : 'text-gray-500'
          }`}>
            {hasVotingToken ? '✓' : '✗'}
            {hasVotingToken
              ? 'You have a voting token'
              : hasVoted
              ? 'Vote already cast'
              : 'No voting token found'}
          </div>

          {!hasVotingToken && !hasVoted && (
            <div className="bg-yellow-500/10 border border-yellow-500 rounded p-3 text-xs font-mono">
              You need to claim your voting token before you can vote.
            </div>
          )}

          {hasVoted && (
            <div className="bg-green-500/10 border border-green-500 rounded p-3 text-xs font-mono">
              ✓ Your vote has been recorded on-chain
            </div>
          )}
        </div>

        {/* Voting Ended Warning */}
        {isVotingEnded && (
          <div className="bg-red-500/10 border border-red-500 rounded p-3 text-sm font-mono">
            ⚠ Voting period has ended. No more votes can be cast.
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

        {/* Vote Choice Selection */}
        {hasVotingToken && !hasVoted && !isVotingEnded && (
          <div className="border border-gray-700 rounded p-4 space-y-3">
            <div className="text-sm font-mono text-gray-300 font-bold">SELECT YOUR VOTE:</div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-700 rounded cursor-pointer hover:border-green-500 transition-colors">
                <input
                  type="radio"
                  name="vote"
                  value="Yes"
                  checked={voteChoice === 'Yes'}
                  onChange={(e) => setVoteChoice(e.target.value as 'Yes' | 'No')}
                  className="w-4 h-4"
                />
                <span className="font-mono text-green-500 font-bold">YES - Vote in favor</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-700 rounded cursor-pointer hover:border-red-500 transition-colors">
                <input
                  type="radio"
                  name="vote"
                  value="No"
                  checked={voteChoice === 'No'}
                  onChange={(e) => setVoteChoice(e.target.value as 'Yes' | 'No')}
                  className="w-4 h-4"
                />
                <span className="font-mono text-red-500 font-bold">NO - Vote against</span>
              </label>
            </div>
          </div>
        )}

        {/* Vote Button */}
        <button
          onClick={handleVote}
          disabled={loading || !hasVotingToken || hasVoted || isVotingEnded || !voteChoice}
          className="w-full px-4 py-3 bg-green-500 text-black font-mono font-bold rounded hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'CASTING VOTE...'
            : hasVoted
            ? 'VOTE CAST'
            : isVotingEnded
            ? 'VOTING ENDED'
            : !voteChoice
            ? 'SELECT YOUR VOTE'
            : `CAST VOTE (${voteChoice.toUpperCase()})`}
        </button>

        {/* Voting Info */}
        <div className="text-xs text-gray-500 font-mono space-y-1 border-t border-gray-700 pt-4">
          <p>→ Voting by sending token to Voting Validator</p>
          <p>→ Required votes: {requiredVotes} (50% + 1 of {totalMembers} members)</p>
          <p>→ No vote reclaiming in v1 (final when cast)</p>
          <p>→ Not voting = abstain (no penalty)</p>
          {!willPass && !isVotingEnded && (
            <p className="text-yellow-500">
              ⚠ {requiredVotes - currentVotes} more vote{requiredVotes - currentVotes !== 1 ? 's' : ''} needed to pass
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
