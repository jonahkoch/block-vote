'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface VoteResultsProps {
  governanceActionId: string;
  title: string;
  votingDeadline: number;
  totalMembers: number;
  requiredVotes: number;
  currentVotes: number;
  refTokenUnit: string;
  createdAt: number;
  yesVotes?: number;
  noVotes?: number;
}

export function VoteResults({
  governanceActionId,
  title,
  votingDeadline,
  totalMembers,
  requiredVotes,
  currentVotes,
  refTokenUnit,
  createdAt,
  yesVotes = 0,
  noVotes = 0,
}: VoteResultsProps) {
  const { theme } = useTheme();
  const [isFinalized, setIsFinalized] = useState(false);

  useEffect(() => {
    setIsFinalized(Date.now() > votingDeadline);
  }, [votingDeadline]);

  const votesPassed = currentVotes >= requiredVotes;
  const participationRate = ((currentVotes / totalMembers) * 100).toFixed(1);
  const votePercentage = ((currentVotes / requiredVotes) * 100).toFixed(1);
  const abstainVotes = totalMembers - currentVotes;

  const result = isFinalized
    ? votesPassed
      ? 'APPROVED'
      : 'NON-BINDING'
    : 'IN PROGRESS';

  const resultColor = isFinalized
    ? votesPassed
      ? 'text-green-500'
      : 'text-yellow-500'
    : 'text-blue-500';

  const explorerUrl = `https://preview.cexplorer.io/token/${refTokenUnit}`;

  return (
    <div className="terminal-box">
      <div className="terminal-header">┌─ VOTE RESULTS</div>
      <div className="p-6 space-y-6">
        {/* Result Banner */}
        <div className={`text-center border-2 rounded p-6 ${
          isFinalized
            ? votesPassed
              ? 'border-green-500 bg-green-500/10'
              : 'border-yellow-500 bg-yellow-500/10'
            : 'border-blue-500 bg-blue-500/10'
        }`}>
          <div className={`text-4xl font-mono font-bold mb-2 ${resultColor}`}>
            {result}
          </div>
          {isFinalized && (
            <div className="text-sm font-mono text-gray-400">
              {votesPassed
                ? 'This governance action has reached the required threshold and is now binding'
                : 'This governance action did not reach the required threshold and remains non-binding (default action)'}
            </div>
          )}
        </div>

        {/* Vote Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center space-y-1">
            <div className="text-gray-500 text-xs font-mono">VOTES CAST</div>
            <div className="text-2xl font-mono font-bold">{currentVotes}</div>
            <div className="text-xs font-mono text-gray-500">
              of {totalMembers} members
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="text-gray-500 text-xs font-mono">REQUIRED</div>
            <div className="text-2xl font-mono font-bold">{requiredVotes}</div>
            <div className="text-xs font-mono text-gray-500">
              (50% + 1)
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="text-gray-500 text-xs font-mono">PARTICIPATION</div>
            <div className="text-2xl font-mono font-bold">{participationRate}%</div>
            <div className="text-xs font-mono text-gray-500">
              turnout rate
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="text-gray-500 text-xs font-mono">THRESHOLD</div>
            <div className={`text-2xl font-mono font-bold ${
              parseFloat(votePercentage) >= 100 ? 'text-green-500' : ''
            }`}>
              {votePercentage}%
            </div>
            <div className="text-xs font-mono text-gray-500">
              {parseFloat(votePercentage) >= 100 ? 'reached' : 'of target'}
            </div>
          </div>
        </div>

        {/* Visual Vote Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono text-gray-500">
            <span>VOTE BREAKDOWN</span>
            <span>{yesVotes} YES / {noVotes} NO / {abstainVotes} ABSTAIN</span>
          </div>
          <div className="flex h-8 rounded overflow-hidden border border-gray-700">
            <div
              className="bg-green-500 flex items-center justify-center text-xs font-mono font-bold text-black"
              style={{ width: `${(yesVotes / totalMembers) * 100}%` }}
            >
              {yesVotes > 0 && `${yesVotes} YES`}
            </div>
            <div
              className="bg-red-500 flex items-center justify-center text-xs font-mono font-bold text-black"
              style={{ width: `${(noVotes / totalMembers) * 100}%` }}
            >
              {noVotes > 0 && `${noVotes} NO`}
            </div>
            <div
              className="bg-gray-800 flex items-center justify-center text-xs font-mono text-gray-500"
              style={{ width: `${(abstainVotes / totalMembers) * 100}%` }}
            >
              {abstainVotes > 0 && `${abstainVotes} ABSTAIN`}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="border-t border-gray-700 pt-4 space-y-2">
          <div className="text-xs font-mono text-gray-500 mb-3">TIMELINE</div>

          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="flex-1">
              <div className="text-sm font-mono">Governance Action Created</div>
              <div className="text-xs font-mono text-gray-500">
                {new Date(createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              isFinalized ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
            }`} />
            <div className="flex-1">
              <div className="text-sm font-mono">
                Voting {isFinalized ? 'Ended' : 'Period'}
              </div>
              <div className="text-xs font-mono text-gray-500">
                {new Date(votingDeadline).toLocaleString()}
              </div>
            </div>
          </div>

          {isFinalized && (
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${
                votesPassed ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <div className="flex-1">
                <div className="text-sm font-mono">
                  Result: {votesPassed ? 'APPROVED (Binding)' : 'NON-BINDING (Default Action)'}
                </div>
                <div className="text-xs font-mono text-gray-500">
                  Final result determined by threshold: {currentVotes} {votesPassed ? '≥' : '<'} {requiredVotes}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* On-Chain Reference */}
        <div className="border-t border-gray-700 pt-4">
          <div className="text-xs font-mono text-gray-500 mb-2">ON-CHAIN REFERENCE</div>
          <div className="bg-gray-900 rounded p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-gray-500">Governance Action ID:</span>
              <span className="text-xs font-mono break-all">{governanceActionId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-gray-500">Reference Token:</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-green-500 hover:underline break-all"
              >
                View on Explorer ↗
              </a>
            </div>
          </div>
        </div>

        {/* Implementation Notes */}
        {isFinalized && (
          <div className={`border-t border-gray-700 pt-4 ${
            votesPassed ? 'bg-green-500/5' : 'bg-yellow-500/5'
          } rounded p-4`}>
            <div className="text-sm font-mono font-bold mb-2">
              {votesPassed ? '✓ NEXT STEPS' : 'ℹ WHAT THIS MEANS'}
            </div>
            <div className="text-xs font-mono text-gray-400 space-y-1">
              {votesPassed ? (
                <>
                  <p>→ This governance action has been APPROVED by the voting members</p>
                  <p>→ The blockVote organization can now proceed with implementation</p>
                  <p>→ All members are bound by this decision</p>
                  <p>→ Member accountability tracking will record compliance</p>
                </>
              ) : (
                <>
                  <p>→ This governance action did NOT reach the required threshold</p>
                  <p>→ The result is NON-BINDING (default action applies)</p>
                  <p>→ No enforcement or compliance tracking required</p>
                  <p>→ Members who abstained face no penalties</p>
                  <p>→ The proposal may be resubmitted with modifications</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Active Voting Notice */}
        {!isFinalized && (
          <div className="bg-blue-500/10 border border-blue-500 rounded p-4">
            <div className="text-sm font-mono font-bold mb-2">
              ⏳ VOTING IN PROGRESS
            </div>
            <div className="text-xs font-mono text-gray-400">
              Results are preliminary until the voting deadline passes. Members can still cast their votes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
