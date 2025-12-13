import { GovernanceActionList } from '@/components/GovernanceActionList';
import Link from 'next/link';

export default function GovernancePage() {
  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center p-8 pt-24 md:px-8 lg:px-24 xl:px-40 2xl:px-56">
        <main className="flex flex-col items-center gap-8 max-w-6xl w-full">
          {/* Header */}
          <div className="w-full text-center space-y-4">
            <div className="ascii-art">
{`┌─────────────────────────────┐
│    G O V E R N A N C E      │
│         P A C T S           │
└─────────────────────────────┘`}
            </div>
            <p className="text-sm text-gray-500 font-mono">
              Create, vote on, and manage Governance Pact Actions for the blockVote caucus.
            </p>
          </div>

          {/* Create Action Button */}
          <Link
            href="/governance/create"
            className="px-6 py-3 bg-green-500 text-black font-mono font-bold rounded hover:bg-green-400 transition-colors"
          >
            + CREATE GOVERNANCE PACT
          </Link>

          {/* Governance Actions List */}
          <GovernanceActionList />

          {/* Info Footer */}
          <div className="w-full max-w-6xl terminal-box mt-8">
            <div className="terminal-header">┌─ HOW IT WORKS</div>
            <div className="p-4 text-xs text-gray-500 font-mono space-y-2">
              <p>1. Admin creates governance action with qualified member list</p>
              <p>2. Members claim their voting tokens</p>
              <p>3. Members cast votes by sending tokens to Voting Validator</p>
              <p>4. Vote passes if threshold reached (50% + 1) by deadline</p>
              <p>5. Approved actions are binding; non-binding actions are default</p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
