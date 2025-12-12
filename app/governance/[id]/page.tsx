'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClaimVotingToken } from '@/components/ClaimVotingToken';
import { CastVote } from '@/components/CastVote';
import { VoteResults } from '@/components/VoteResults';
import Link from 'next/link';
import type { GovernanceAction } from '@/components/GovernanceActionList';

export default function GovernanceActionDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [action, setAction] = useState<GovernanceAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [voteBreakdown, setVoteBreakdown] = useState<{ yesVotes: number; noVotes: number }>({ yesVotes: 0, noVotes: 0 });

  useEffect(() => {
    loadGovernanceAction();
  }, [id]);

  const loadGovernanceAction = async () => {
    setLoading(true);

    try {
      // Query real governance actions from blockchain
      const { queryGovernancePacts } = await import('@/lib/query-pacts');
      const pacts = await queryGovernancePacts();

      console.log('=== Governance Action Detail Page ===');
      console.log('Looking for ID:', id);
      console.log('Available pact IDs:', pacts.map(p => p.id));

      // Find the specific pact by ID (id format: txHash#outputIndex)
      const pact = pacts.find(p => p.id === id);

      if (pact) {
        console.log('✅ Found real governance action:', pact);
        console.log('RefTokenUnit:', pact.refTokenUnit);
        setAction(pact);

        // Fetch vote breakdown
        try {
          const { queryVotesForPact } = await import('@/lib/query-pacts');

          // Parse token info from refTokenUnit
          const refTokenUnit = pact.refTokenUnit;
          const REFERENCE_LABEL = '000643b0';
          const USER_LABEL = '001bc280';
          const refLabelIndex = refTokenUnit.indexOf(REFERENCE_LABEL);

          if (refLabelIndex !== -1) {
            const policyId = refTokenUnit.substring(0, refLabelIndex);
            const baseTokenName = refTokenUnit.substring(refLabelIndex + REFERENCE_LABEL.length);
            const userTokenName = USER_LABEL + baseTokenName;

            const voteResults = await queryVotesForPact(policyId, userTokenName);
            setVoteBreakdown({
              yesVotes: voteResults.yesVotes,
              noVotes: voteResults.noVotes,
            });
            console.log('Vote breakdown:', voteResults);
          }
        } catch (err) {
          console.warn('Failed to fetch vote breakdown:', err);
        }
      } else {
        // Fallback to mock data if not found
        console.warn('⚠️ Governance action not found, using mock data');
        console.warn('Searched for:', id);
        console.warn('Available IDs:', pacts.map(p => p.id));
        const mockAction: GovernanceAction = {
          id,
          title: 'Approve Treasury Spending for Marketing',
          description: `This governance action proposes to allocate 50,000 ADA from the blockVote treasury for a comprehensive Q1 2025 marketing campaign.

The funds will be used for:
- Social media advertising campaigns
- Community event sponsorships
- Content creation and influencer partnerships
- Brand awareness initiatives

Expected outcomes:
- 30% increase in community engagement
- 500+ new DRep onboardings
- Enhanced brand visibility across Cardano ecosystem`,
          createdAt: Date.now() - 86400000,
          votingDeadline: Date.now() + 86400000,
          totalMembers: 10,
          requiredVotes: 6,
          currentVotes: 7,
          status: 'active',
          refTokenUnit: 'policy123...000643b0476f76...',
        };

        setAction(mockAction);
      }
    } catch (err) {
      console.error('Failed to load governance action:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-8 pt-24">
          <div className="text-center text-gray-500 font-mono animate-pulse">
            Loading governance action...
          </div>
        </div>
      </>
    );
  }

  if (!action) {
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center p-8 pt-24">
          <div className="terminal-box max-w-2xl">
            <div className="terminal-header">┌─ ERROR</div>
            <div className="p-8 text-center">
              <div className="text-red-500 font-mono mb-4">
                ✗ Governance action not found
              </div>
              <Link
                href="/governance"
                className="text-sm font-mono text-green-500 hover:underline"
              >
                ← Back to Governance Actions
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const isVotingActive = Date.now() < action.votingDeadline;

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center p-8 pt-24">
        <main className="flex flex-col gap-8 max-w-6xl w-full">
          {/* Back Link */}
          <div className="w-full">
            <Link
              href="/governance"
              className="text-sm font-mono text-gray-500 hover:text-green-500 transition-colors"
            >
              ← Back to Governance Actions
            </Link>
          </div>

          {/* Governance Action Details */}
          <div className="terminal-box">
            <div className="terminal-header">┌─ GOVERNANCE ACTION DETAILS</div>
            <div className="p-6 space-y-4">
              <div>
                <h1 className="text-2xl font-mono font-bold mb-2 break-words">
                  {action.title}
                </h1>
                <div className="text-sm text-gray-500 font-mono break-all">
                  ID: {action.id}
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="text-sm font-mono text-gray-500 mb-2">DESCRIPTION</div>
                <div className="text-sm font-mono whitespace-pre-wrap text-gray-300 break-words">
                  {action.description}
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-mono mb-4">
                  <div>
                    <div className="text-gray-500 mb-1">Status</div>
                    <div className={`font-bold ${
                      action.status === 'active' ? 'text-blue-500' :
                      action.status === 'approved' ? 'text-green-500' :
                      action.status === 'non-binding' ? 'text-yellow-500' :
                      'text-gray-500'
                    }`}>
                      {action.status.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Created</div>
                    <div>{new Date(action.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Deadline</div>
                    <div>{new Date(action.votingDeadline).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Members</div>
                    <div>{action.totalMembers}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Voting Section */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Claim Token (only show if voting active) */}
            {isVotingActive && (() => {
              // Extract policy ID and token names from refTokenUnit
              // refTokenUnit format: policyId + referenceTokenName (label 100: 000643b0)
              // We need: policyId + userTokenName (label 222: 001bc280)

              const refTokenUnit = action.refTokenUnit;

              console.log('=== Token Parsing Debug ===');
              console.log('refTokenUnit:', refTokenUnit);
              console.log('refTokenUnit length:', refTokenUnit.length);

              // Reference token label is 8 characters (000643b0)
              // Everything before that is the policy ID
              const REFERENCE_LABEL = '000643b0';
              const USER_LABEL = '001bc280';

              // Find where the reference label starts
              const refLabelIndex = refTokenUnit.indexOf(REFERENCE_LABEL);

              console.log('refLabelIndex:', refLabelIndex);

              if (refLabelIndex === -1) {
                console.error('❌ Could not parse refTokenUnit - reference label not found');
                console.error('Expected to find:', REFERENCE_LABEL);
                console.error('In:', refTokenUnit);
                // Try to continue anyway - maybe the format is different
                // Show the component with the full refTokenUnit as policyId for debugging
                return (
                  <div className="terminal-box">
                    <div className="terminal-header">⚠️ TOKEN PARSING ERROR</div>
                    <div className="p-4 text-sm font-mono text-red-500">
                      <p>Could not parse refTokenUnit format.</p>
                      <p className="text-xs text-gray-500 mt-2 break-all">RefTokenUnit: {refTokenUnit}</p>
                      <p className="text-xs text-gray-500">Expected format: policyId + {REFERENCE_LABEL} + baseName</p>
                    </div>
                  </div>
                );
              }

              // Extract policy ID (everything before the reference label)
              const policyId = refTokenUnit.substring(0, refLabelIndex);

              // Extract base token name (everything after the reference label)
              const baseTokenName = refTokenUnit.substring(refLabelIndex + REFERENCE_LABEL.length);

              // Construct user token name (label 222 + base name)
              const userTokenName = USER_LABEL + baseTokenName;

              console.log('✅ Successfully parsed token info:');
              console.log('  Policy ID:', policyId);
              console.log('  Base Token Name:', baseTokenName);
              console.log('  User Token Name:', userTokenName);

              return (
                <ClaimVotingToken
                  governanceActionId={action.id}
                  policyId={policyId}
                  fractionTokenName={userTokenName}
                  authorizedMembers={[
                    'stake_test1uzpq2pktpnj4dzh4c2qkc0jz9gxtej3ezm0z6k8z5z5z5z',
                    // More members...
                  ]}
                  alreadyClaimed={[
                    // Members who claimed...
                  ]}
                />
              );
            })()}

            {/* Cast Vote */}
            {(() => {
              // Parse token info same as above
              const refTokenUnit = action.refTokenUnit;
              const REFERENCE_LABEL = '000643b0';
              const USER_LABEL = '001bc280';
              const refLabelIndex = refTokenUnit.indexOf(REFERENCE_LABEL);

              if (refLabelIndex === -1) {
                console.error('Could not parse refTokenUnit for CastVote:', refTokenUnit);
                return (
                  <div className="terminal-box">
                    <div className="terminal-header">⚠️ TOKEN PARSING ERROR</div>
                    <div className="p-4 text-sm font-mono text-red-500">
                      <p>Could not parse refTokenUnit format for voting.</p>
                    </div>
                  </div>
                );
              }

              const policyId = refTokenUnit.substring(0, refLabelIndex);
              const baseTokenName = refTokenUnit.substring(refLabelIndex + REFERENCE_LABEL.length);
              const userTokenName = USER_LABEL + baseTokenName;

              return (
                <CastVote
                  governanceActionId={action.id}
                  policyId={policyId}
                  fractionTokenName={userTokenName}
                  votingDeadline={action.votingDeadline}
                  currentVotes={action.currentVotes}
                  requiredVotes={action.requiredVotes}
                  totalMembers={action.totalMembers}
                />
              );
            })()}
          </div>

          {/* Vote Results */}
          <VoteResults
            governanceActionId={action.id}
            title={action.title}
            votingDeadline={action.votingDeadline}
            totalMembers={action.totalMembers}
            requiredVotes={action.requiredVotes}
            currentVotes={action.currentVotes}
            refTokenUnit={action.refTokenUnit}
            createdAt={action.createdAt}
            yesVotes={voteBreakdown.yesVotes}
            noVotes={voteBreakdown.noVotes}
          />
        </main>
      </div>
    </>
  );
}
