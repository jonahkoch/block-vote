'use client';

import { useState, useEffect } from 'react';
import type {
  CardanoGovernanceAction,
  GovernanceActionListResponse,
  CardanoNetwork,
} from '@/types/cardano-governance';
import {
  isExpired,
  getTimeRemaining,
  formatVoteCount,
} from '@/types/cardano-governance';

interface GovernanceActionBrowserProps {
  onSelect: (action: CardanoGovernanceAction) => void;
  onClose: () => void;
  network?: CardanoNetwork;
}

export function GovernanceActionBrowser({
  onSelect,
  onClose,
  network = 'preview',
}: GovernanceActionBrowserProps) {
  const [actions, setActions] = useState<CardanoGovernanceAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    loadGovernanceActions();
  }, [page]);

  const loadGovernanceActions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://be.gov.tools/proposal/list?page=${page}&pageSize=${pageSize}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch governance actions');
      }

      const data: GovernanceActionListResponse = await response.json();

      setActions(data.elements);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load governance actions:', err);
      setError('Failed to load Cardano governance actions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredActions = actions.filter((action) => {
    // Filter out expired actions
    if (isExpired(action.expiryDate)) return false;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !action.title.toLowerCase().includes(term) &&
        !action.abstract.toLowerCase().includes(term)
      ) {
        return false;
      }
    }

    // Filter by type
    if (filterType !== 'all' && action.type !== filterType) {
      return false;
    }

    return true;
  });

  // Get unique types for filter dropdown
  const uniqueTypes = Array.from(new Set(actions.map((a) => a.type)));

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border-2 border-green-500 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-green-500 p-4 flex justify-between items-center">
          <h2 className="text-xl font-mono font-bold text-green-500">
            SELECT CARDANO GOVERNANCE ACTION
          </h2>
          <button
            onClick={onClose}
            className="text-green-500 hover:text-green-400 font-mono text-2xl"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-700 space-y-2">
          <input
            type="text"
            placeholder="Search by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-black border border-gray-700 rounded font-mono text-sm focus:border-green-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-black border border-gray-700 rounded font-mono text-sm focus:border-green-500 focus:outline-none"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button
              onClick={loadGovernanceActions}
              disabled={loading}
              className="px-3 py-2 border border-gray-700 rounded font-mono text-sm hover:border-green-500 disabled:opacity-50"
            >
              {loading ? 'LOADING...' : 'REFRESH'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && actions.length === 0 ? (
            <div className="text-center text-gray-500 font-mono py-8">
              Loading governance actions...
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500 rounded p-4 text-sm font-mono text-red-500">
              {error}
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="text-center text-gray-500 font-mono py-8">
              No active governance actions found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActions.map((action) => (
                <div
                  key={action.id}
                  className="border border-gray-700 rounded p-4 hover:border-green-500 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="flex-1">
                      <h3 className="font-mono font-bold text-lg mb-1">
                        {action.title}
                      </h3>
                      <div className="flex gap-3 text-xs text-gray-500 font-mono">
                        <span className="text-blue-500">{action.type}</span>
                        <span>Epoch {action.expiryEpochNo}</span>
                        <span className="text-yellow-500">
                          {getTimeRemaining(action.expiryDate)} remaining
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm font-mono text-gray-400 mb-3 line-clamp-2">
                    {action.abstract}
                  </p>

                  <div className="flex gap-4 text-xs font-mono mb-3">
                    <div>
                      <span className="text-gray-500">YES: </span>
                      <span className="text-green-500">
                        {formatVoteCount(action.dRepYesVotes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">NO: </span>
                      <span className="text-red-500">
                        {formatVoteCount(action.dRepNoVotes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">ABSTAIN: </span>
                      <span className="text-yellow-500">
                        {formatVoteCount(action.dRepAbstainVotes)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 font-mono">
                      Created: {new Date(action.createdDate).toLocaleDateString()}
                      <br />
                      Expires: {new Date(action.expiryDate).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() => onSelect(action)}
                      className="px-4 py-2 bg-green-500/20 border-2 border-green-500 text-green-500 font-mono font-bold rounded hover:bg-green-500/30 transition-colors"
                    >
                      [ SELECT ]
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="border-t border-gray-700 p-4 flex justify-between items-center">
            <div className="text-sm text-gray-500 font-mono">
              Page {page + 1} of {Math.ceil(total / pageSize)} ({filteredActions.length} of {total} actions)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 border border-gray-700 rounded font-mono text-sm hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                PREV
              </button>
              <button
                onClick={() => setPage(Math.min(Math.ceil(total / pageSize) - 1, page + 1))}
                disabled={page >= Math.ceil(total / pageSize) - 1}
                className="px-3 py-1 border border-gray-700 rounded font-mono text-sm hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
