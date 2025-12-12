import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center p-8 pt-24">
        <main className="flex flex-col items-center gap-8 max-w-4xl w-full">
          <div className="ascii-art text-center">
{`┌─────────────────────────┐
│ V O T I N G  B L O C K  │
└─────────────────────────┘`}
          </div>
          <p className="text-xl text-center text-gray-600 dark:text-gray-400">
            Collective Accountability 1 Person 1 Vote 
          </p>

          {/* Navigation Box */}
          <div className="w-full max-w-2xl terminal-box-double p-8">
            <div className="terminal-header mb-6">┌─ NAVIGATE</div>
            <div className="flex flex-col gap-4">
              <Link
                href="/governance"
                className="w-full px-6 py-4 border-2 border-green-500 text-green-500 font-mono font-bold rounded transition-colors text-center"
              >
                [ VIEW GOVERNANCE PACTS ]
              </Link>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-600 font-mono text-center mt-6">
              └─ Click [ WALLET ] to connect
            </div>
          </div>

          <div className="terminal-box w-full">
            <div className="terminal-header">┌─ FEATURES</div>
            <div className="p-4 space-y-2 text-sm font-mono">
              <div className="flex items-start gap-2">
                <span className="text-green-500">→</span>
                <div>
                  <div className="font-bold">CIP-068 Fractionalization</div>
                  <div className="text-xs text-gray-500">Dual token model for flexible governance</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">→</span>
                <div>
                  <div className="font-bold">50% + 1 Voting Threshold</div>
                  <div className="text-xs text-gray-500">Simple majority required for approval</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">→</span>
                <div>
                  <div className="font-bold">DRep Member Verification</div>
                  <div className="text-xs text-gray-500">Active DReps with token gating</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">→</span>
                <div>
                  <div className="font-bold">Non-Binding Fallback</div>
                  <div className="text-xs text-gray-500">Unmet threshold = default action</div>
                </div>
              </div>
            </div>
          </div>
          <div className="terminal-box w-full">
            <div className="terminal-header">┌─ STATUS</div>
            <ul className="space-y-1 p-4">
              <li className="status-ok">Next.js + TypeScript + Tailwind CSS</li>
              <li className="status-ok">Lucid Evolution for Cardano integration</li>
              <li className="status-ok">Mesh SDK Wallet connection</li>
              <li className="status-ok">Token gating</li>
              <li className="status-ok">CIP-068 approach to fractionalization</li>
              <li className="status-ok">On-chain voting</li>
              <li className="status-pending">Aiken smart contract development</li>
            </ul>
            <div className="text-xs text-gray-500 font-mono p-4 border-t border-gray-700">
              └─ PHASE 3: FRONTEND READY / CONTRACTS IN PROGRESS
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
