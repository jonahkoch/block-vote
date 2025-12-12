'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';

export type GovernanceActionStatus = 'active' | 'completed' | 'approved' | 'non-binding';

export interface GovernanceAction {
  id: string;
  title: string;
  description: string;
  createdAt: number; // POSIX timestamp
  votingDeadline: number; // POSIX timestamp
  totalMembers: number;
  requiredVotes: number;
  currentVotes: number;
  status: GovernanceActionStatus;
  refTokenUnit: string; // Policy ID + asset name
}

export function GovernanceActionList() {
  const { theme } = useTheme();
  const [actions, setActions] = useState<GovernanceAction[]>([]);
  const [filter, setFilter] = useState<GovernanceActionStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGovernanceActions();
  }, []);

  const loadGovernanceActions = async () => {
    setLoading(true);

    try {
      // Try to query real PACTs from blockchain
      const { queryGovernancePacts, isBlockfrostConfigured } = await import('@/lib/query-pacts');

      let realActions: GovernanceAction[] = [];

      if (isBlockfrostConfigured()) {
        try {
          console.log('Querying real governance PACTs from blockchain...');
          realActions = await queryGovernancePacts();
          console.log(`Loaded ${realActions.length} real PACTs`);
        } catch (error) {
          console.error('Failed to load real PACTs, falling back to mock data:', error);
        }
      } else {
        console.warn('Blockfrost not configured, using mock data');
      }

      // If we got real PACTs, use them
      if (realActions.length > 0) {
        setActions(realActions);
        setLoading(false);
        return;
      }

      // Otherwise, fallback to mock data for development
      console.log('Using mock data for development');
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockActions: GovernanceAction[] = [
        {
          id: 'example_001',
          title: '[Example] Active Voting in Progress',
          description: 'This is sample data. Real governance pacts will appear here once created and decoded from the blockchain.',
          createdAt: Date.now() - 86400000, // 1 day ago
          votingDeadline: Date.now() + 86400000, // 1 day from now
          totalMembers: 10,
          requiredVotes: 6,
          currentVotes: 7,
          status: 'active',
          refTokenUnit: 'example...policy...id',
        },
        {
          id: 'example_002',
          title: '[Example] Approved Governance Action',
          description: 'This is sample data showing what an approved action looks like. Create real pacts using the button above.',
          createdAt: Date.now() - 172800000, // 2 days ago
          votingDeadline: Date.now() - 3600000, // 1 hour ago (completed)
          totalMembers: 10,
          requiredVotes: 6,
          currentVotes: 8,
          status: 'approved',
          refTokenUnit: 'example...policy...id',
        },
        {
          id: 'example_003',
          title: '[Example] Non-Binding Action (Failed Vote)',
          description: 'This is sample data showing a failed vote that did not reach the required threshold.',
          createdAt: Date.now() - 259200000, // 3 days ago
          votingDeadline: Date.now() - 86400000, // 1 day ago (completed)
          totalMembers: 10,
          requiredVotes: 6,
          currentVotes: 4,
          status: 'non-binding',
          refTokenUnit: 'example...policy...id',
        },
      ];

      setActions(mockActions);
    } catch (err) {
      console.error('Failed to load governance actions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredActions = filter === 'all'
    ? actions
    : actions.filter(action => action.status === filter);

  const getStatusColor = (status: GovernanceActionStatus) => {
    switch (status) {
      case 'active':
        return theme === 'terminal' ? 'text-green-500' : 'text-blue-500';
      case 'completed':
        return 'text-gray-500';
      case 'approved':
        return 'text-green-500';
      case 'non-binding':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusLabel = (status: GovernanceActionStatus) => {
    switch (status) {
      case 'active':
        return 'VOTING IN PROGRESS';
      case 'completed':
        return 'COMPLETED';
      case 'approved':
        return 'APPROVED (BINDING)';
      case 'non-binding':
        return 'NON-BINDING';
      default:
        return String(status).toUpperCase();
    }
  };

  const getVoteProgress = (action: GovernanceAction) => {
    return Math.min((action.currentVotes / action.requiredVotes) * 100, 100);
  };

  const getTimeRemaining = (deadline: number) => {
    const now = Date.now();
    const diff = deadline - now;

    if (diff <= 0) return 'ENDED';

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="terminal-box">
        <div className="terminal-header">┌─ GOVERNANCE PACT ACTIONS</div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 p-4 border-b border-gray-700">
          {['all', 'active', 'approved', 'non-binding', 'completed'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption as typeof filter)}
              className={`px-3 py-1 text-xs font-mono border rounded transition-colors ${
                filter === filterOption
                  ? 'border-green-500 bg-green-500/20'
                  : 'border-gray-700 hover:border-green-500'
              }`}
            >
              {filterOption.toUpperCase()}
            </button>
          ))}
          <button
            onClick={loadGovernanceActions}
            disabled={loading}
            className="ml-auto px-3 py-1 text-xs font-mono border border-gray-700 rounded hover:border-green-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'LOADING...' : 'REFRESH'}
          </button>
        </div>

        {/* Actions List */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-mono animate-pulse">
              Loading governance actions...
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-mono">
              No governance actions found
              {filter !== 'all' && ` with status: ${filter}`}
            </div>
          ) : (
            filteredActions.map((action) => (
              <Link
                key={action.id}
                href={`/governance/${encodeURIComponent(action.id)}`}
                className="block"
              >
                <div className="space-y-3 p-4 border border-gray-700 rounded-lg bg-gray-900/50 hover:bg-green-500/5 hover:border-green-500/50 transition-all">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-mono font-bold text-lg mb-1 break-words">
                        {action.title}
                      </h3>
                      <p className="text-sm text-gray-500 font-mono line-clamp-2 break-words">
                        {action.description}
                      </p>
                    </div>
                    <div className={`font-mono text-xs font-bold whitespace-nowrap ${getStatusColor(action.status)}`}>
                      {getStatusLabel(action.status)}
                    </div>
                  </div>

                  {/* Vote Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span>
                        {action.currentVotes} / {action.requiredVotes} votes
                        {action.currentVotes >= action.requiredVotes && ' ✓'}
                      </span>
                      <span className="text-gray-500">
                        {Math.round(getVoteProgress(action))}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          action.currentVotes >= action.requiredVotes
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${getVoteProgress(action)}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-between items-center text-xs font-mono text-gray-500">
                    <span>
                      {new Date(action.createdAt).toLocaleDateString()}
                    </span>
                    <span>
                      {getTimeRemaining(action.votingDeadline)}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
