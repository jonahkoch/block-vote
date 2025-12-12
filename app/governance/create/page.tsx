import { CreateGovernanceAction } from '@/components/CreateGovernanceAction';
import Link from 'next/link';

// Force dynamic rendering to avoid WASM issues during build
export const dynamic = 'force-dynamic';

export default function CreateGovernanceActionPage() {
  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center p-8 pt-24">
        <main className="flex flex-col items-center gap-8 max-w-4xl w-full">
          {/* Back Link */}
          <div className="w-full">
            <Link
              href="/governance"
              className="text-sm font-mono text-gray-500 hover:text-green-500 transition-colors"
            >
              ← Back to Governance Pact Actions
            </Link>
          </div>

          {/* Header */}
          <div className="w-full text-center space-y-4">
            <div className="ascii-art">
{`┌──────────────────────────┐
│   G O V E R N A N C E    │
│         P A C T S        │
└──────────────────────────┘`}
            </div>
          </div>

          {/* Create Form */}
          <CreateGovernanceAction />
        </main>
      </div>
    </>
  );
}
