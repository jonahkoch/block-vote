'use client';

import { useState } from 'react';
import { useWallet } from '@meshsdk/react';
import { useTransactionLibrary } from './TransactionLibraryProvider';
import { GovernanceActionBrowser } from './GovernanceActionBrowser';
import type {
  CardanoGovernanceAction,
  CardanoNetwork,
} from '@/types/cardano-governance';
import { calculateBlockVoteDeadline } from '@/types/cardano-governance';
import {
  buildCreatePactTx,
  selectUtxoForMinting,
  addressesToCredentials,
} from '@/lib/transactions';
import { buildCreatePactTx_Lucid } from '@/lib/transactions-lucid';
import {
  generatePactAssetName,
  calculateRequiredVotes,
  METADATA_VALIDATOR_HASH,
  DISTRIBUTION_VALIDATOR_HASH,
  MINTING_POLICY_HASH,
} from '@/lib/contracts';
import type { GovernancePactDatum, CreatePactParams } from '@/types/contracts';

interface QualifiedMember {
  stakeAddress: string;
  drepId: string;
  hasRequiredToken: boolean;
}

export function CreateGovernanceAction() {
  const { wallet, connected } = useWallet();
  const { library } = useTransactionLibrary();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedCardanoAction, setSelectedCardanoAction] = useState<CardanoGovernanceAction | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [network] = useState<CardanoNetwork>('preprod'); // TODO: Get from wallet or config
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    votingDurationHours: 24,
  });
  const [qualifiedMembers, setQualifiedMembers] = useState<QualifiedMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle selection of Cardano governance action
  const handleSelectCardanoAction = (action: CardanoGovernanceAction) => {
    setSelectedCardanoAction(action);
    setShowBrowser(false);

    // Auto-populate form with Cardano governance action data
    const blockVoteDeadline = calculateBlockVoteDeadline(action.expiryDate, network);
    const now = new Date();
    const durationMs = blockVoteDeadline.getTime() - now.getTime();
    const durationHours = Math.max(1, Math.floor(durationMs / (1000 * 60 * 60)));

    setFormData({
      title: action.title,
      description: action.abstract,
      votingDurationHours: durationHours,
    });
  };

  // Placeholder for member verification
  const verifyQualifiedMembers = async () => {
    setVerifying(true);
    setError(null);

    try {
      // TODO: Implement actual verification logic
      // This will query blockchain for:
      // 1. Active DReps
      // 2. Check if they hold required policy ID token
      // 3. Future: Check delegation < 10M ADA

      // Mock data for now - use connected wallet's addresses for testing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get addresses from connected wallet
      const walletAddress = await wallet.getChangeAddress();
      const rewardAddress = await wallet.getRewardAddresses();
      const stakeAddress = rewardAddress && rewardAddress.length > 0
        ? rewardAddress[0]
        : walletAddress; // Fallback to change address if no stake address

      // Create mock members using the actual wallet address
      // For testing: This creates 3 mock members (you can adjust the number)
      const mockMembers: QualifiedMember[] = [
        {
          stakeAddress: stakeAddress,
          drepId: 'drep1_mock_1',
          hasRequiredToken: true,
        },
        {
          stakeAddress: stakeAddress,
          drepId: 'drep1_mock_2',
          hasRequiredToken: true,
        },
        {
          stakeAddress: stakeAddress,
          drepId: 'drep1_mock_3',
          hasRequiredToken: true,
        },
      ];

      console.log('Mock qualified members:', mockMembers);
      setQualifiedMembers(mockMembers);
    } catch (err) {
      setError('Failed to verify qualified members. Please try again.');
      console.error('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!selectedCardanoAction) {
      setError('Please select a Cardano governance action first');
      return;
    }

    if (qualifiedMembers.length === 0) {
      setError('No qualified members found. Please verify members first.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Generate unique asset name
      const assetName = generatePactAssetName();
      console.log('Generated asset name:', assetName);

      // 2. Convert member addresses to credentials
      const qualifiedCredentials = await addressesToCredentials(
        qualifiedMembers.map((m) => m.stakeAddress)
      );
      console.log('Converted credentials:', qualifiedCredentials.length);

      // 3. Select UTxO for one-time minting
      const utxoRef = await selectUtxoForMinting(wallet);
      console.log('Selected UTxO:', utxoRef);

      // 4. Calculate voting deadline
      const blockVoteDeadline = calculateBlockVoteDeadline(
        selectedCardanoAction.expiryDate,
        network
      );
      console.log('Voting deadline:', blockVoteDeadline);

      // 5. Build governance pact datum
      const pactDatum: GovernancePactDatum = {
        title: formData.title,
        description: formData.description,
        cardanoActionId: `${selectedCardanoAction.txHash}#${selectedCardanoAction.index}`,
        cardanoActionType: selectedCardanoAction.type,
        votingDeadline: blockVoteDeadline.getTime(),
        totalMembers: qualifiedMembers.length,
        requiredVotes: calculateRequiredVotes(qualifiedMembers.length),
        policyId: MINTING_POLICY_HASH,
        assetName: assetName,
        metadataValidator: METADATA_VALIDATOR_HASH,
        distributionValidator: DISTRIBUTION_VALIDATOR_HASH,
      };
      console.log('Built pact datum:', pactDatum);

      // 6. Get user's address
      const userAddress = await wallet.getChangeAddress();
      console.log('User address:', userAddress);

      // 7. Build transaction parameters
      const params: CreatePactParams = {
        userAddress,
        utxoRef,
        qualifiedMembers: qualifiedCredentials,
        pactDatum,
        assetName,
      };

      // 8. Build and submit transaction
      console.log(`Building transaction with ${library.toUpperCase()}...`);
      const result = library === 'lucid'
        ? await buildCreatePactTx_Lucid(wallet, params)
        : await buildCreatePactTx(wallet, params);

      if (result.success) {
        setSuccess(
          `Governance pact created successfully using ${library.toUpperCase()}! Transaction: ${result.txHash}`
        );
        console.log('Transaction submitted:', result.txHash);

        // Reset form
        setFormData({
          title: '',
          description: '',
          votingDurationHours: 24,
        });
        setQualifiedMembers([]);
        setSelectedCardanoAction(null);
      } else {
        setError(`Transaction failed: ${result.error}`);
        console.error('Transaction error:', result.error);
      }
    } catch (err) {
      setError(
        `Failed to create governance pact: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
      console.error('Transaction error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Governance Action Browser Modal */}
      {showBrowser && (
        <GovernanceActionBrowser
          onSelect={handleSelectCardanoAction}
          onClose={() => setShowBrowser(false)}
          network={network}
        />
      )}

      <div className="terminal-box">
        <div className="terminal-header">┌─ CREATE PACT</div>

        {!connected && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded mb-4">
            ⚠ Please connect your wallet to create governance pacts
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {/* Browse Cardano Governance Actions Button */}
          {!selectedCardanoAction ? (
            <div className="text-center py-8">
              <button
                type="button"
                onClick={() => setShowBrowser(true)}
                disabled={loading || !connected}
                className="w-full px-6 py-4 bg-blue-500/20 border-2 border-blue-500 text-blue-500 font-mono font-bold rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                [ BROWSE CARDANO GOVERNANCE ACTIONS ]
              </button>
              <p className="text-sm text-gray-400 mt-4 font-mono">
                All governance pacts must be based on on-chain Cardano governance actions
              </p>
              <p className="text-xs text-gray-500 mt-2 font-mono">
                Select a live governance action to create a blockVote pact for your organization
              </p>
            </div>
          ) : (
            <>
              {/* Selected Cardano Action Display */}
              <div className="bg-blue-500/10 border-2 border-blue-500 rounded p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="text-xs font-mono text-blue-500 mb-2 font-bold">
                        SELECTED CARDANO GOVERNANCE ACTION
                      </div>
                      <div className="text-lg font-mono font-bold">
                        {selectedCardanoAction.title}
                      </div>
                    </div>

                    {/* Data Points - Moved here */}
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-blue-500">Type:</span>
                        <div className="text-white mt-1">{selectedCardanoAction.type}</div>
                      </div>
                      <div>
                        <span className="text-blue-500">Epoch:</span>
                        <div className="text-white mt-1">{selectedCardanoAction.expiryEpochNo}</div>
                      </div>
                      <div>
                        <span className="text-blue-500">On-chain Expiry:</span>
                        <div className="text-white mt-1">
                          {new Date(selectedCardanoAction.expiryDate).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-blue-500">BlockVote Deadline:</span>
                        <div className="text-yellow-500 mt-1 font-bold">
                          {calculateBlockVoteDeadline(selectedCardanoAction.expiryDate, network).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Description - Moved below data points */}
                    <div className="border-t border-blue-500/30 pt-3">
                      <div className="text-sm font-mono text-gray-400 max-h-[20rem] overflow-y-auto">
                        {selectedCardanoAction.abstract}
                      </div>
                      <div className="text-xs text-gray-500 mt-2 italic">
                        → BlockVote voting ends 3 epochs before Cardano governance action expires
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCardanoAction(null);
                      setFormData({ title: '', description: '', votingDurationHours: 24 });
                      setQualifiedMembers([]);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-xs font-mono text-gray-500 hover:text-red-500 whitespace-nowrap"
                  >
                    [ CHANGE ]
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Member Verification - Only show when action is selected */}
          {selectedCardanoAction && (
            <div className="border-t border-gray-700 pt-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-mono">
                  QUALIFIED MEMBERS
                </label>
                <button
                  type="button"
                  onClick={verifyQualifiedMembers}
                  disabled={verifying || loading || !connected}
                  className="px-3 py-1 text-xs font-mono border border-gray-700 rounded hover:border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? 'VERIFYING...' : 'VERIFY MEMBERS'}
                </button>
              </div>

            {qualifiedMembers.length > 0 && (
              <div className="bg-green-500/10 border border-green-500 rounded p-3 space-y-2">
                <div className="text-sm font-mono">
                  ✓ Found {qualifiedMembers.length} qualified member{qualifiedMembers.length !== 1 ? 's' : ''}
                </div>
                <div className="text-xs font-mono text-gray-400">
                  Required votes: {Math.floor(qualifiedMembers.length / 2) + 1} (50% + 1)
                </div>
                <details className="text-xs font-mono">
                  <summary className="cursor-pointer hover:text-green-500">
                    View member list
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {qualifiedMembers.map((member, idx) => (
                      <li key={idx} className="text-gray-500">
                        {idx + 1}. {member.stakeAddress.slice(0, 20)}...
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            )}

            {verifying && (
              <div className="text-sm font-mono text-gray-400 animate-pulse">
                Querying blockchain for active DReps and token holders...
              </div>
            )}
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
            <div className="bg-green-500/10 border border-green-500 rounded p-3 text-sm font-mono">
              ✓ {success}
            </div>
          )}

          {/* Submit Button - Only show when action is selected */}
          {selectedCardanoAction && (
            <button
              type="submit"
              disabled={loading || !connected || qualifiedMembers.length === 0}
              className="w-full px-4 py-3 bg-green-500 text-black font-mono font-bold rounded hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'CREATING...' : 'CREATE GOVERNANCE PACT'}
            </button>
          )}

          {/* Info */}
          <div className="text-xs text-gray-500 font-mono space-y-1 border-t border-gray-700 pt-4">
            <p>→ Members must be active DReps</p>
            <p>→ Members must hold required policy ID token</p>
            <p>→ Voting threshold: Simple majority (50% + 1)</p>
            <p>→ Unmet threshold: Non-binding (default action)</p>
          </div>
        </form>
      </div>
    </div>
  );
}
