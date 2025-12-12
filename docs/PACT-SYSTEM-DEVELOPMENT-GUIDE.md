# PACT Membership System - Development Guide

**Status**: ✅ MVP Complete
**Last Updated**: 2025-12-10
**Network**: Cardano Preview Testnet

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Aiken Smart Contract](#aiken-smart-contract)
4. [Transaction Building (Lucid Evolution)](#transaction-building-lucid-evolution)
5. [Blockfrost Integration](#blockfrost-integration)
6. [Frontend Implementation](#frontend-implementation)
7. [Token Detection](#token-detection)
8. [CIP-25 Metadata](#cip-25-metadata)
9. [Testing & Debugging](#testing--debugging)
10. [Future Enhancements](#future-enhancements)

---

## System Overview

### What is PACT?

PACT (Platform Access & Commitment Token) is a **membership NFT system** that token-gates access to blockVote governance features. Users must hold a PACT token to claim voting tokens for governance proposals.

### Key Features

- **One-time minting**: Each wallet can mint exactly one PACT token
- **Cost**: 10 ADA to claim (enforced by frontend)
- **DRep eligibility**: Only eligible DReps can claim PACT tokens
- **Parameterized minting policy**: Uses UTxO reference for one-time guarantee
- **Unique token names**: Blake2b-256 hash of wallet address
- **CIP-25 metadata**: Includes blue "P" icon for wallet display
- **Token detection**: Detects PACT by asset name (not policy ID)

### Eligibility Requirements

To claim a PACT token, users must meet ALL of these criteria:

1. **Active DRep Registration**: Must be registered as a DRep on-chain
2. **Delegation Threshold**: Delegated amount < 13,000,000 ADA (13M ADA)
3. **Minimum Balance**: Wallet balance ≥ 10 ADA

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     PACT Token System                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐     ┌────────────┐ │
│  │   Frontend   │─────▶│  Blockfrost  │────▶│  Cardano   │ │
│  │  (Next.js)   │      │     API      │     │  Preview   │ │
│  └──────┬───────┘      └──────────────┘     └────────────┘ │
│         │                                                    │
│         │                                                    │
│  ┌──────▼───────┐      ┌──────────────┐                    │
│  │    Lucid     │─────▶│    Aiken     │                    │
│  │  Evolution   │      │  Validator   │                    │
│  └──────────────┘      └──────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
block-vote/
├── components/
│   ├── ClaimPactDrawer.tsx          # PACT claiming UI
│   └── PactDrawerButton.tsx         # Global drawer button
├── lib/
│   ├── transactions-pact.ts         # Transaction builder
│   ├── query-pact-token.ts          # Token detection
│   ├── query-drep.ts                # DRep eligibility checking
│   ├── governance-icon.ts           # SVG icons (P icon)
│   ├── base64-chunker.ts            # Metadata image chunking
│   └── lucid-provider.ts            # Lucid initialization
└── public/
    └── plutus.json                  # Compiled Aiken validators

block-vote-contracts/
└── validators/
    └── pact_membership.ak           # Aiken minting policy
```

---

## Aiken Smart Contract

### File Location

`/Users/joko/Development/coLab/block-vote-contracts/validators/pact_membership.ak`

### Contract Code

```aiken
use cardano/transaction.{Input, OutputReference, Transaction}
use cardano/assets.{PolicyId, tokens}
use aiken/collection/list
use aiken/collection/dict
use aiken/builtin.{blake2b_256}

/// Redeemer for PACT membership minting
pub type PactMembershipRedeemer {
  ClaimPact
}

/// Parameterized minting policy for one-time PACT token minting
///
/// Rules:
/// 1. The specified UTxO must be consumed in the transaction
/// 2. Exactly 1 token must be minted
///
/// Parameters:
/// - utxo_ref: OutputReference - The UTxO that must be consumed (ensures one-time minting)
validator pact_membership(utxo_ref: OutputReference) {
  mint(_redeemer: PactMembershipRedeemer, own_policy: PolicyId, tx: Transaction) {
    let Transaction { inputs, mint, .. } = tx

    // Rule 1: Verify that the parameterized UTxO is consumed
    expect list.any(
      inputs,
      fn(input) {
        input.output_reference.transaction_id == utxo_ref.transaction_id &&
        input.output_reference.output_index == utxo_ref.output_index
      },
    )

    // Rule 2: Exactly 1 token must be minted
    let minted_assets = mint |> tokens(own_policy) |> dict.to_pairs()
    when minted_assets is {
      [Pair(_, quantity)] -> quantity == 1
      _ -> False
    }
  }

  else(_) {
    fail
  }
}
```

### Key Concepts

#### Parameterized Minting Policy

The minting policy is **parameterized by a UTxO reference** (`OutputReference`). This means:

1. When applying parameters, you provide a specific UTxO (txHash + outputIndex)
2. That UTxO **must be consumed** in the minting transaction
3. Once consumed, it can never be used again
4. This guarantees **one-time minting** per parameter application

#### Why Parameterization?

Without parameterization, a simple "mint once" policy could be bypassed by:
- Minting in different transactions
- Creating multiple minting transactions in parallel

With parameterization:
- Each user gets a **unique policy ID** based on their selected UTxO
- The policy can only mint once because the UTxO can only be spent once
- Different users have different policy IDs (but same token name pattern)

### Compilation

```bash
cd /Users/joko/Development/coLab/block-vote-contracts
aiken build
```

**Output**: `plutus.json` containing compiled validator code

**Important**: Copy `plutus.json` to `/Users/joko/Development/coLab/block-vote/public/plutus.json` for frontend access

### Script Hash

The **base script hash** (before parameterization):
```
41d4a7889e03e582859d39be04f276b1453d0e38b6c0c81b75b5a4d5
```

**Note**: The actual policy ID after parameterization will be different for each UTxO used.

---

## Transaction Building (Lucid Evolution)

### File Location

`/Users/joko/Development/coLab/block-vote/lib/transactions-pact.ts`

### Core Function: `buildClaimPactTx`

```typescript
export async function buildClaimPactTx(
  wallet: BrowserWallet,
  userAddress: string
) {
  // 1. Import dependencies
  const { initializeLucid, connectMeshWalletToLucid } = await import('./lucid-provider');
  const { Constr, Data, toUnit, applyParamsToScript, validatorToScriptHash } =
    await import('@lucid-evolution/lucid');

  // 2. Fetch plutus.json from public directory
  const plutusJsonResponse = await fetch('/plutus.json');
  const plutusJson = await plutusJsonResponse.json();

  // 3. Initialize Lucid and connect wallet
  const lucid = await initializeLucid();
  await connectMeshWalletToLucid(lucid, wallet);

  // 4. Get UTxOs from wallet
  const meshUtxos = await wallet.getUtxos();
  const lucidUtxos = await lucid.wallet().getUtxos();

  // 5. Select a UTxO for parameterization
  const utxoRef = await selectUtxoForPactMinting(wallet);

  // 6. Find PACT validator in plutus.json
  const pactValidator = plutusJson.validators.find(
    (v: any) => v.title === 'pact_membership.pact_membership.mint'
  );

  // 7. Convert UTxO reference to Plutus Data format
  const utxoRefData = new Constr(0, [
    utxoRef.txHash,              // ByteArray (hex string)
    BigInt(utxoRef.outputIndex), // Int
  ]);

  // 8. Apply parameters to create unique minting policy
  const pactScript = {
    type: "PlutusV3" as const,
    script: applyParamsToScript(
      pactValidator.compiledCode,
      [utxoRefData]  // Pass raw Constr, NOT Data.to()
    ),
  };

  // 9. Get the actual policy ID
  const policyId = validatorToScriptHash(pactScript);

  // 10. Generate unique token name (Blake2b-256 hash of address)
  const tokenName = generatePactTokenName(userAddress);

  // 11. Create asset unit
  const assetUnit = toUnit(policyId, tokenName);

  // 12. Create redeemer
  const redeemer = Data.to(new Constr(0, [])); // ClaimPact

  // 13. Build CIP-25 metadata
  const metadata = buildPactMetadata(policyId, tokenName);

  // 14. Find selected UTxO in Lucid format
  const selectedLucidUtxo = lucidUtxos.find(u =>
    u.txHash === utxoRef.txHash && u.outputIndex === utxoRef.outputIndex
  );

  // 15. Build transaction
  const tx = await lucid
    .newTx()
    .collectFrom([selectedLucidUtxo])
    .mintAssets({ [assetUnit]: BigInt(1) }, redeemer)
    .attach.MintingPolicy(pactScript)
    .attachMetadata(721, metadata['721'])
    .complete();

  // 16. Sign with Mesh wallet
  const unsignedTxCbor = tx.toCBOR();
  const signedTx = await wallet.signTx(unsignedTxCbor, true);

  // 17. Submit transaction
  const txHash = await wallet.submitTx(signedTx);

  return {
    success: true,
    txHash,
    policyId,
    tokenName,
    assetUnit,
  };
}
```

### Critical Implementation Details

#### 1. UTxO Reference Encoding

```typescript
// CORRECT - Direct values
const utxoRefData = new Constr(0, [
  utxoRef.txHash,              // String (hex)
  BigInt(utxoRef.outputIndex), // BigInt
]);

// WRONG - Double wrapping
const utxoRefData = new Constr(0, [
  new Constr(0, [utxoRef.txHash]), // ❌ Too many layers
  BigInt(utxoRef.outputIndex),
]);
```

#### 2. Applying Parameters

```typescript
// CORRECT - Raw Constr object
applyParamsToScript(
  pactValidator.compiledCode,
  [utxoRefData]  // Pass Constr directly
);

// WRONG - CBOR encoded
applyParamsToScript(
  pactValidator.compiledCode,
  [Data.to(utxoRefData)]  // ❌ Don't encode before applying
);

// WRONG - Extra parameters argument
applyParamsToScript(
  pactValidator.compiledCode,
  [utxoRefData],
  pactValidator.parameters  // ❌ Don't pass this
);
```

#### 3. Wallet Integration (Mesh + Lucid)

```typescript
// 1. Initialize Lucid
const lucid = await initializeLucid();

// 2. Connect Mesh wallet to Lucid
await connectMeshWalletToLucid(lucid, wallet);

// 3. Get Lucid-formatted UTxOs
const lucidUtxos = await lucid.wallet().getUtxos();  // Note: wallet() is a function

// 4. Build transaction with Lucid
const tx = await lucid.newTx()...

// 5. Sign with Mesh wallet (NOT Lucid signing)
const signedTx = await wallet.signTx(unsignedTxCbor, true);

// 6. Submit with Mesh wallet
const txHash = await wallet.submitTx(signedTx);
```

#### 4. Token Name Generation

```typescript
function generatePactTokenName(userAddress: string): string {
  const { blake2b } = require('blakejs');
  const addressBytes = Buffer.from(userAddress, 'utf8');
  const hash = blake2b(addressBytes, null, 32);  // 32 bytes = 64 hex chars
  return Buffer.from(hash).toString('hex');
}
```

### Helper Function: `selectUtxoForPactMinting`

```typescript
async function selectUtxoForPactMinting(wallet: BrowserWallet) {
  const utxos = await wallet.getUtxos();

  // Filter for UTxOs with sufficient ADA (≥15 ADA)
  const suitableUtxos = utxos.filter(utxo => {
    const lovelace = utxo.output.amount.find(a => a.unit === 'lovelace');
    return lovelace && BigInt(lovelace.quantity) >= 15_000_000n;
  });

  if (suitableUtxos.length === 0) {
    throw new Error('No UTxOs with ≥15 ADA available');
  }

  // Select random UTxO
  const randomIndex = Math.floor(Math.random() * suitableUtxos.length);
  const selected = suitableUtxos[randomIndex];

  return {
    txHash: selected.input.txHash,
    outputIndex: selected.input.outputIndex,
  };
}
```

**Why ≥15 ADA?**
- Transaction fee: ~2 ADA
- Min UTxO requirement: ~2 ADA
- PACT cost: 10 ADA
- Buffer: 1 ADA

---

## Blockfrost Integration

### File Location

`/Users/joko/Development/coLab/block-vote/lib/query-drep.ts`

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_BLOCKFROST_PREVIEW_API_KEY=your_api_key_here
```

### DRep Eligibility Checking

```typescript
export async function checkPactEligibility(wallet: BrowserWallet): Promise<PactEligibility> {
  // 1. Get stake address
  const stakeAddress = await getStakeAddress(wallet);
  if (!stakeAddress) {
    return {
      isEligible: false,
      reason: 'Could not get stake address',
      // ... other fields
    };
  }

  // 2. Query DRep account info from Blockfrost
  const drepInfo = await getDRepAccountInfo(stakeAddress);

  // 3. Get wallet balance
  const walletBalance = await getWalletBalance(wallet);

  // 4. Check thresholds
  const isDRep = drepInfo?.active_epoch !== null && drepInfo?.active_epoch !== undefined;
  const delegationLovelace = BigInt(drepInfo?.amount || '0');
  const passesDelegationThreshold = delegationLovelace < DELEGATION_THRESHOLD;
  const hasMinimumBalance = walletBalance >= MIN_WALLET_BALANCE;

  const isEligible = isDRep && passesDelegationThreshold && hasMinimumBalance;

  return {
    isEligible,
    isDRep,
    delegationLovelace: Number(delegationLovelace),
    delegationAda: Number(delegationLovelace) / 1_000_000,
    walletBalanceLovelace: walletBalance,
    walletBalanceAda: walletBalance / 1_000_000,
    passesDelegationThreshold,
    hasMinimumBalance,
    reason: isEligible ? null : getIneligibilityReason(/*...*/),
  };
}
```

### Blockfrost API Endpoints Used

#### 1. Get Stake Address from Wallet Address

```typescript
const response = await fetch(
  `${BLOCKFROST_URL}/addresses/${walletAddress}`,
  {
    headers: { project_id: BLOCKFROST_API_KEY },
  }
);
const data = await response.json();
const stakeAddress = data.stake_address;
```

**Endpoint**: `GET /addresses/{address}`
**Returns**: Address details including stake_address

#### 2. Get DRep Account Info

```typescript
const response = await fetch(
  `${BLOCKFROST_URL}/accounts/${stakeAddress}/delegations`,
  {
    headers: { project_id: BLOCKFROST_API_KEY },
  }
);
const delegations = await response.json();
const drepInfo = delegations[delegations.length - 1]; // Latest delegation
```

**Endpoint**: `GET /accounts/{stake_address}/delegations`
**Returns**: Array of delegation history

**Key Fields**:
- `active_epoch`: Epoch when DRep became active (null if not DRep)
- `amount`: Delegated amount in lovelace (string)
- `pool_id`: Pool ID (for pool delegation) or DRep ID

#### 3. Get Wallet Balance

```typescript
const utxos = await wallet.getUtxos();
const totalLovelace = utxos.reduce((sum, utxo) => {
  const lovelace = utxo.output.amount.find(a => a.unit === 'lovelace');
  return sum + (lovelace ? BigInt(lovelace.quantity) : 0n);
}, 0n);
```

**Method**: Direct wallet query (not Blockfrost)
**Returns**: Total lovelace across all UTxOs

### Thresholds

```typescript
// Delegation threshold: < 13M ADA
const DELEGATION_THRESHOLD = 13_000_000_000_000; // 13M ADA in lovelace

// Minimum wallet balance: ≥ 10 ADA
const MIN_WALLET_BALANCE = 10_000_000; // 10 ADA in lovelace
```

### Error Handling

```typescript
// Handle timeout on UTxO fetch
const utxosPromise = wallet.getUtxos();
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('timeout')), 5000)
);

try {
  const utxos = await Promise.race([utxosPromise, timeoutPromise]);
  // Process UTxOs
} catch (error) {
  if (error.message === 'timeout') {
    console.warn('Wallet UTxO fetch timed out');
    return 0; // Default to 0 balance
  }
  throw error;
}
```

---

## Frontend Implementation

### ClaimPactDrawer Component

**File**: `/Users/joko/Development/coLab/block-vote/components/ClaimPactDrawer.tsx`

#### Component Structure

```typescript
export default function ClaimPactDrawer({
  isOpen,
  onClose,
}: ClaimPactDrawerProps) {
  // State management
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<PactEligibility | null>(null);
  const [hasPact, setHasPact] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [stakeAddress, setStakeAddress] = useState('');

  // Wallet context
  const { wallet, connected } = useWallet();

  // Check eligibility on mount
  useEffect(() => {
    if (!wallet || !connected) return;

    async function checkEligibility() {
      setLoading(true);

      // Get addresses
      const address = await wallet.getChangeAddress();
      setWalletAddress(address);

      const stake = await getStakeAddress(wallet);
      setStakeAddress(stake || '');

      // Check eligibility
      const result = await checkPactEligibility(wallet);
      setEligibility(result);

      // Check if user already has PACT
      const pactStatus = await hasPactToken(wallet);
      setHasPact(pactStatus);

      setLoading(false);
    }

    checkEligibility();
  }, [wallet, connected, isOpen]);

  // Handle PACT claim
  const handleClaimPact = async () => {
    if (!wallet || !eligibility?.isEligible) return;

    try {
      setLoading(true);
      const { buildClaimPactTx } = await import('@/lib/transactions-pact');
      const result = await buildClaimPactTx(wallet, walletAddress);

      // Refresh PACT status
      const pactStatus = await hasPactToken(wallet);
      setHasPact(pactStatus);

      alert(`✅ PACT token claimed successfully!\n\nTransaction: ${result.txHash}`);
    } catch (error) {
      alert(`❌ Failed to claim PACT token:\n\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Render drawer UI
  return (
    // ... JSX
  );
}
```

#### UI Sections

1. **Payment Address Box**
   ```tsx
   <div className="terminal-box-double">
     <div className="terminal-header">┌─ PAYMENT ADDRESS</div>
     <div className="p-3">
       <div className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">
         {walletAddress}
       </div>
       <button onClick={() => navigator.clipboard.writeText(walletAddress)}>
         [ COPY ]
       </button>
     </div>
   </div>
   ```

2. **Stake Address Box**
   ```tsx
   <div className="terminal-box-double">
     <div className="terminal-header">┌─ STAKE ADDRESS</div>
     <div className="p-3">
       <div className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">
         {stakeAddress || 'Not available'}
       </div>
       {stakeAddress && (
         <button onClick={() => navigator.clipboard.writeText(stakeAddress)}>
           [ COPY ]
         </button>
       )}
     </div>
   </div>
   ```

3. **Balance Box**
   ```tsx
   <div className="terminal-box-double">
     <div className="terminal-header">┌─ BALANCE</div>
     <div className="p-3">
       <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
         {eligibility ? eligibility.walletBalanceAda.toFixed(2) : '0.00'} ₳
       </div>
       <div className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1">
         ADA
       </div>
     </div>
   </div>
   ```

4. **DRep Status Box**
   ```tsx
   <div className="terminal-box-double">
     <div className="terminal-header">┌─ DREP STATUS</div>
     <div className="p-3 space-y-2">
       <div className="flex items-center justify-between text-sm font-mono">
         <span className="text-gray-600 dark:text-gray-400">Registration:</span>
         <span className={`font-bold ${eligibility.isDRep ? 'text-green-600' : 'text-red-600'}`}>
           {eligibility.isDRep ? '✓ ACTIVE' : '✗ INACTIVE'}
         </span>
       </div>
       <div className="flex items-center justify-between text-sm font-mono">
         <span className="text-gray-600 dark:text-gray-400">Delegation:</span>
         <span className="font-bold text-purple-600 dark:text-purple-400">
           {eligibility.delegationAda.toFixed(2)} ₳
         </span>
       </div>
     </div>
   </div>
   ```

5. **Eligibility Thresholds Box**
   ```tsx
   <div className="terminal-box-double">
     <div className="terminal-header">┌─ ELIGIBILITY</div>
     <div className="p-3 space-y-2">
       <div className="flex items-center justify-between text-sm font-mono">
         <span>Delegation {'<'} 13M ₳:</span>
         <span className={eligibility.passesDelegationThreshold ? 'text-green-600' : 'text-red-600'}>
           {eligibility.passesDelegationThreshold ? '✓ PASS' : '✗ FAIL'}
         </span>
       </div>
       <div className="flex items-center justify-between text-sm font-mono">
         <span>Balance ≥ 10 ₳:</span>
         <span className={eligibility.hasMinimumBalance ? 'text-green-600' : 'text-red-600'}>
           {eligibility.hasMinimumBalance ? '✓ PASS' : '✗ FAIL'}
         </span>
       </div>
     </div>
   </div>
   ```

6. **PACT Token Status & Claim Button**
   ```tsx
   <div className="terminal-box-double">
     <div className="terminal-header">┌─ PACT TOKEN</div>
     <div className="p-3">
       <div className="flex items-center justify-between mb-3">
         <span>Status:</span>
         <span className={hasPact ? 'text-green-600' : 'text-gray-600'}>
           {hasPact ? '✓ CLAIMED' : '✗ NOT CLAIMED'}
         </span>
       </div>

       {!hasPact && (
         <button
           onClick={handleClaimPact}
           disabled={!eligibility?.isEligible}
           className={eligibility?.isEligible
             ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-500'
             : 'bg-gray-300 text-gray-500 cursor-not-allowed'
           }
         >
           {eligibility?.isEligible ? '[ CLAIM - 10 ₳ ]' : '[ INELIGIBLE ]'}
         </button>
       )}
     </div>
   </div>
   ```

#### Styling Guidelines

**Terminal Box Style**:
```css
.terminal-box-double {
  @apply border-2 border-gray-700 rounded;
}

.terminal-header {
  @apply px-3 py-1 font-mono text-sm text-gray-600 dark:text-gray-400 border-b border-gray-700;
}
```

**Color Palette**:
- Primary accent: Purple (`#9333ea` / `purple-600`)
- Success: Green (`text-green-600 dark:text-green-400`)
- Error: Red (`text-red-600 dark:text-red-400`)
- Balance: Green (`text-green-600 dark:text-green-400`)
- Delegation: Purple (`text-purple-600 dark:text-purple-400`)

### Global Button Component

**File**: `/Users/joko/Development/coLab/block-vote/components/PactDrawerButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import ClaimPactDrawer from './ClaimPactDrawer';

export function PactDrawerButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-44 top-4 z-40 px-4 py-2 bg-purple-500/20 border-2 border-purple-500 text-purple-500 dark:text-purple-400 font-mono font-bold rounded hover:bg-purple-500/30 transition-colors"
      >
        [ CLAIM PACT ]
      </button>
      <ClaimPactDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
```

**Integration in Layout**:

```typescript
// app/layout.tsx
import { PactDrawerButton } from '@/components/PactDrawerButton';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WalletDrawer />
        <PactDrawerButton />  {/* Add here */}
        <LibraryToggle />
        {children}
      </body>
    </html>
  );
}
```

---

## Token Detection

### File Location

`/Users/joko/Development/coLab/block-vote/lib/query-pact-token.ts`

### Why Detection by Asset Name?

Since PACT uses **parameterized minting**, each user gets a **unique policy ID** when they mint. This means we can't detect PACT tokens by a single policy ID.

Instead, we detect by the **token name**, which is always the **Blake2b-256 hash of the user's address**.

### Implementation

```typescript
/**
 * Generate expected PACT token name for a given address
 */
function generatePactTokenName(userAddress: string): string {
  const { blake2b } = require('blakejs');
  const addressBytes = Buffer.from(userAddress, 'utf8');
  const hash = blake2b(addressBytes, null, 32);
  return Buffer.from(hash).toString('hex');
}

/**
 * Check if user has PACT token in their wallet
 */
export async function hasPactToken(
  wallet: BrowserWallet,
  userAddress?: string
): Promise<boolean> {
  // Get user address if not provided
  if (!userAddress) {
    userAddress = await wallet.getChangeAddress();
  }

  // Generate expected token name
  const expectedTokenName = generatePactTokenName(userAddress);

  // Get all UTxOs
  const utxos = await wallet.getUtxos();

  // Check if any asset has the matching token name
  const hasPact = utxos.some(utxo =>
    utxo.output.amount.some(asset => {
      if (asset.unit === 'lovelace') return false;

      // Extract token name (last 64 chars of unit)
      // Format: [policyId(56 chars)][tokenName(64 chars)]
      const tokenName = asset.unit.substring(56);
      return tokenName === expectedTokenName;
    })
  );

  return hasPact;
}
```

### Asset Unit Format

Cardano native assets have this format:

```
[policyId][tokenName]
```

- **Policy ID**: First 56 characters (28 bytes hex)
- **Token Name**: Remaining characters (variable length, max 32 bytes = 64 hex chars)

Example:
```
a4ba1e33893d2b47f1cf0a7c50e66913cb35470a84f4102a093e3025cd1fd585cd2d8f1c976b8491acc203cdbc5ee88a8ac99c6f72566d513ecbedf0
└──────────────────── policyId ────────────────────┘└──────────────────── tokenName ────────────────────┘
         (56 chars / 28 bytes)                                  (64 chars / 32 bytes)
```

### Get PACT Token Info

```typescript
export async function getPactTokenInfo(
  wallet: BrowserWallet,
  userAddress?: string
): Promise<PactTokenInfo | null> {
  if (!userAddress) {
    userAddress = await wallet.getChangeAddress();
  }

  const expectedTokenName = generatePactTokenName(userAddress);
  const utxos = await wallet.getUtxos();

  for (const utxo of utxos) {
    for (const asset of utxo.output.amount) {
      if (asset.unit === 'lovelace') continue;

      const policyId = asset.unit.substring(0, 56);
      const tokenName = asset.unit.substring(56);

      if (tokenName === expectedTokenName) {
        return {
          policyId,
          assetName: tokenName,
          unit: asset.unit,
          quantity: parseInt(asset.quantity),
          txHash: utxo.input.txHash,
        };
      }
    }
  }

  return null;
}
```

### Integration in WalletDrawer

The PACT token is automatically counted in the wallet's asset count:

```typescript
// WalletDrawer.tsx
const allAssets = new Set<string>();
utxos.forEach((utxo) => {
  utxo.output.amount.forEach((asset) => {
    if (asset.unit !== 'lovelace') {
      allAssets.add(asset.unit); // PACT token included here
    }
  });
});

setWalletInfo({
  address: address || 'Unknown',
  balance: (totalLovelace / 1_000_000).toFixed(2),
  assetsCount: allAssets.size, // Count includes PACT
});
```

---

## CIP-25 Metadata

### What is CIP-25?

**CIP-25** (Cardano Improvement Proposal 25) is the standard for **NFT metadata** on Cardano. It defines how to attach human-readable information (name, description, image) to native assets.

### Metadata Structure

```json
{
  "721": {
    "[policyId]": {
      "[assetName]": {
        "name": "PACT Membership",
        "description": "Membership token for blockVote governance platform. Required for claiming voting tokens.",
        "image": ["data:image/svg+xml;base64,PHN2Zy...", "...more chunks..."],
        "mediaType": "image/svg+xml",
        "membership_type": "PACT",
        "version": "1.0"
      }
    }
  }
}
```

### Why Chunk the Image?

Lucid Evolution has a **64-character limit per metadata field**. Large base64-encoded images exceed this limit, so we:

1. Convert SVG to base64 data URI
2. Split into chunks of ≤64 characters
3. Store as an array
4. Wallets concatenate chunks to reconstruct the image

### Implementation

#### 1. SVG Icon

**File**: `/Users/joko/Development/coLab/block-vote/lib/governance-icon.ts`

```typescript
export const PACT_ICON_BLUE_SVG = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="377.337px" height="377.338px" viewBox="0 0 377.337 377.338" xml:space="preserve">
<g>
  <path fill="#0033AD" d="M301.687,53.505H75.648c-10.876,0-19.725,8.843-19.725,19.713v230.904c0,10.873,8.843,19.722,19.725,19.722h226.039
    c10.873,0,19.722-8.844,19.722-19.722V73.218C321.404,62.348,312.56,53.505,301.687,53.505z M200.272,148.947
    c0,7.587-3.885,14.187-11.633,19.825c-7.762,5.637-16.648,8.455-26.672,8.455h-38.166v51.799H85.892V76.356h76.203
    c10.025,0,18.889,2.834,26.605,8.506c7.704,5.669,11.564,12.26,11.564,19.773v44.312H200.272z M123.808,104.534h38.558v44.506
    h-38.558V104.534z M338.674,0H38.66C19.092,0,3.223,15.869,3.223,35.434v306.462c0,19.573,15.869,35.442,35.437,35.442h300.02
    c19.568,0,35.436-15.869,35.436-35.442V35.434C374.115,15.869,358.248,0,338.674,0z M335.378,304.122
    c0,18.572-15.113,33.691-33.691,33.691H75.648c-18.576,0-33.695-15.114-33.695-33.691V73.218c0-18.569,15.114-33.688,33.695-33.688
    h226.039c18.572,0,33.691,15.114,33.691,33.688V304.122z"/>
</g>
</svg>`;
```

**Design**: Blue "P" icon (Cardano blue #0033AD)
**Size**: ~1,200 bytes
**Chunks (when base64)**: ~26 chunks

#### 2. Base64 Chunking

**File**: `/Users/joko/Development/coLab/block-vote/lib/base64-chunker.ts`

```typescript
/**
 * Convert SVG to chunked base64 data URI array
 */
export function svgToChunkedDataUri(svg: string, chunkSize: number = 64): string[] {
  // 1. Convert SVG to base64 data URI
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  const dataUri = `data:image/svg+xml;base64,${base64}`;

  // 2. Split into chunks
  return chunkDataUri(dataUri, chunkSize);
}

/**
 * Split data URI into chunks
 */
function chunkDataUri(dataUri: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < dataUri.length; i += chunkSize) {
    chunks.push(dataUri.substring(i, i + chunkSize));
  }
  return chunks;
}
```

#### 3. Metadata Builder

**File**: `/Users/joko/Development/coLab/block-vote/lib/transactions-pact.ts`

```typescript
import { PACT_ICON_BLUE_SVG } from './governance-icon';
import { svgToChunkedDataUri } from './base64-chunker';

function buildPactMetadata(policyId: string, tokenName: string): any {
  // Convert SVG to chunked base64 data URI
  const imageChunks = svgToChunkedDataUri(PACT_ICON_BLUE_SVG, 64);

  return {
    '721': {
      [policyId]: {
        [tokenName]: {
          name: 'PACT Membership',
          description: 'Membership token for blockVote governance platform. Required for claiming voting tokens.',
          image: imageChunks,
          mediaType: 'image/svg+xml',
          // Custom properties
          membership_type: 'PACT',
          version: '1.0',
        },
      },
    },
  };
}
```

#### 4. Attach to Transaction

```typescript
// Build metadata
const metadata = buildPactMetadata(policyId, tokenName);

// Build transaction with metadata
const tx = await lucid
  .newTx()
  .collectFrom([selectedLucidUtxo])
  .mintAssets({ [assetUnit]: BigInt(1) }, redeemer)
  .attach.MintingPolicy(pactScript)
  .attachMetadata(721, metadata['721'])  // Attach CIP-25 metadata
  .complete();
```

### Viewing Metadata

After minting, the PACT NFT will display with the blue "P" icon in:

1. **Supported wallets**: Eternl, Nami, Typhon, etc.
2. **Block explorers**: Cardanoscan, Pool.pm, etc.
3. **NFT marketplaces**: jpg.store, etc.

Example on Cardanoscan:
```
https://preview.cardanoscan.io/token/[policyId][tokenName]
```

---

## Testing & Debugging

### Common Errors & Solutions

#### 1. "Cannot find module '../../block-vote-contracts/plutus.json'"

**Cause**: Next.js can't import from sibling directories outside project root

**Solution**: Copy plutus.json to public directory
```bash
cp /Users/joko/Development/coLab/block-vote-contracts/plutus.json \
   /Users/joko/Development/coLab/block-vote/public/plutus.json
```

Then fetch at runtime:
```typescript
const plutusJsonResponse = await fetch('/plutus.json');
const plutusJson = await plutusJsonResponse.json();
```

#### 2. "unknown tag: 11; partialUPLC"

**Cause**: Trying to use script hash string instead of compiled code with `applyParamsToScript`

**Solution**: Use compiled code from plutus.json
```typescript
// WRONG
const pactScript = {
  type: "PlutusV3",
  script: applyParamsToScript(SCRIPT_HASH, [utxoRefData])
};

// CORRECT
const pactScript = {
  type: "PlutusV3",
  script: applyParamsToScript(pactValidator.compiledCode, [utxoRefData])
};
```

#### 3. "failed script execution: failed to deserialise PlutusData"

**Cause**: Incorrect Plutus data encoding (usually double-wrapped or CBOR-encoded when it shouldn't be)

**Solutions**:
```typescript
// CORRECT - Direct values
const utxoRefData = new Constr(0, [
  utxoRef.txHash,              // String
  BigInt(utxoRef.outputIndex), // BigInt
]);

// WRONG - Double wrapped
const utxoRefData = new Constr(0, [
  new Constr(0, [utxoRef.txHash]), // ❌
  BigInt(utxoRef.outputIndex),
]);

// CORRECT - Pass raw Constr to applyParamsToScript
applyParamsToScript(compiledCode, [utxoRefData]);

// WRONG - Don't encode before applying
applyParamsToScript(compiledCode, [Data.to(utxoRefData)]); // ❌
```

#### 4. "MISSING_WALLET: please ensure that your wallet has been properly configured"

**Cause**: Wallet not connected to Lucid before building transaction

**Solution**: Use `connectMeshWalletToLucid`
```typescript
const lucid = await initializeLucid();
await connectMeshWalletToLucid(lucid, wallet); // Connect wallet
```

#### 5. "Cannot read properties of undefined (reading 'length')"

**Cause**: Using Mesh UTxO format with Lucid's `collectFrom`

**Solution**: Get Lucid-formatted UTxOs
```typescript
// Get Lucid UTxOs
const lucidUtxos = await lucid.wallet().getUtxos();

// Use in collectFrom
const tx = await lucid
  .newTx()
  .collectFrom([lucidUtxos[0]]) // Use Lucid format
  .complete();
```

#### 6. "lucid.wallet.getUtxos is not a function"

**Cause**: `wallet` is a method, not a property

**Solution**: Call with parentheses
```typescript
// CORRECT
const utxos = await lucid.wallet().getUtxos();

// WRONG
const utxos = await lucid.wallet.getUtxos(); // ❌
```

### Testing Checklist

#### Pre-Deployment Testing

- [ ] **Aiken compilation**: Contract compiles without errors
- [ ] **Plutus.json exists**: File copied to public directory
- [ ] **Environment variables**: Blockfrost API key configured
- [ ] **Network config**: Using Preview network
- [ ] **Wallet connection**: Wallet connects successfully

#### DRep Eligibility Testing

- [ ] **Active DRep**: Shows "✓ ACTIVE" for registered DReps
- [ ] **Delegation check**: Displays correct delegation amount
- [ ] **Balance check**: Shows correct wallet balance
- [ ] **Threshold validation**: Correctly evaluates all three conditions
- [ ] **Error messages**: Shows helpful messages when ineligible

#### PACT Minting Testing

- [ ] **UTxO selection**: Selects UTxO with ≥15 ADA
- [ ] **Transaction building**: Builds transaction without errors
- [ ] **Wallet signing**: Wallet prompts for signature
- [ ] **Transaction submission**: Transaction submits successfully
- [ ] **Confirmation**: Transaction appears on Cardanoscan

#### PACT Detection Testing

- [ ] **Has PACT**: Correctly detects existing PACT token
- [ ] **Token count**: Wallet drawer shows correct asset count
- [ ] **Claim button**: Disabled when PACT already owned
- [ ] **Status display**: Shows "✓ CLAIMED" when PACT owned

#### Metadata Testing

- [ ] **Image display**: Blue "P" icon appears in wallet
- [ ] **Name display**: Shows "PACT Membership"
- [ ] **Description**: Shows correct description
- [ ] **Explorer**: Metadata visible on Cardanoscan

### Debug Logging

Enable verbose logging:

```typescript
// In transactions-pact.ts
console.log('🚀 Building CLAIM PACT transaction...');
console.log('Selected UTxO:', utxoRef);
console.log('Found PACT validator:', pactValidator.title);
console.log('Parameterized Policy ID:', policyId);
console.log('Token name:', tokenName);
console.log('Selected Lucid UTxO:', selectedLucidUtxo);
console.log('Built PACT metadata with image');
console.log('✅ Transaction built successfully');
console.log('🎉 PACT token minted! Transaction hash:', txHash);
```

### Network Inspection

Check browser console for:
- Blockfrost API calls and responses
- Wallet method calls
- Transaction building steps
- Error messages

Check Cardanoscan for:
- Transaction status
- Metadata display
- Script execution
- UTxO consumption

---

## Future Enhancements

### Phase 4: Token-Gating (Next Priority)

**Goal**: Require PACT token ownership to claim voting tokens

**Tasks**:
1. Update `buildClaimGovernanceTx` to check for PACT token
2. Show error message if PACT not owned
3. Add "Get PACT" button to governance detail pages
4. Update governance detail UI to show PACT requirement

**Implementation**:
```typescript
// Before building voting token claim transaction
const hasPact = await hasPactToken(wallet);
if (!hasPact) {
  throw new Error('PACT membership required. Please claim a PACT token first.');
}

// Proceed with voting token claim
const tx = await buildClaimGovernanceTx(...);
```

### Phase 5: PACT Redemption (Future)

**Goal**: Allow users to redeem PACT token for 9 ADA

**Requirements**:
- Burn PACT token
- Return 9 ADA to user (10 ADA cost - 1 ADA fee)
- Update smart contract to allow burning

**Smart Contract**:
```aiken
validator pact_membership(utxo_ref: OutputReference) {
  mint(redeemer: PactMembershipRedeemer, own_policy: PolicyId, tx: Transaction) {
    when redeemer is {
      ClaimPact -> {
        // Minting logic (already implemented)
      }
      RedeemPact -> {
        // Burning logic
        let minted_assets = mint |> tokens(own_policy) |> dict.to_pairs()
        when minted_assets is {
          [Pair(_, quantity)] -> quantity == -1  // Burn 1 token
          _ -> False
        }
      }
    }
  }

  else(_) {
    fail
  }
}
```

### Phase 6: Blacklisting (Future)

**Goal**: Revoke PACT membership for policy violations

**Approach**:
1. Maintain on-chain registry of blacklisted addresses
2. Check blacklist before allowing actions
3. Admin interface for blacklist management

**Smart Contract**:
```aiken
validator pact_membership(utxo_ref: OutputReference, blacklist_ref: OutputReference) {
  mint(redeemer: PactMembershipRedeemer, own_policy: PolicyId, tx: Transaction) {
    // Check if user address is in blacklist
    let user_address = get_user_address(tx)
    expect !is_blacklisted(blacklist_ref, user_address)

    // Continue with minting logic
    // ...
  }

  else(_) {
    fail
  }
}
```

### Phase 7: Deposit Locking (Future)

**Goal**: Lock 10 ADA at script address, redeemable on PACT burn

**Benefits**:
- On-chain guarantee of refund
- More trustless system
- Better user experience

**Smart Contract**:
```aiken
validator pact_deposit(pact_policy: PolicyId) {
  spend(datum: DepositDatum, redeemer: DepositRedeemer, tx: Transaction) {
    when redeemer is {
      Redeem -> {
        // Verify PACT token is being burned
        let burn_amount = get_mint_amount(tx, pact_policy, datum.token_name)
        expect burn_amount == -1

        // Verify payment to original owner
        expect has_payment_to(tx, datum.owner, 9_000_000)  // 9 ADA

        True
      }
    }
  }

  else(_) {
    fail
  }
}
```

### Technical Debt & Improvements

#### 1. Error Handling

**Current**: Basic error messages
**Future**: Structured error types with helpful recovery suggestions

```typescript
class PactError extends Error {
  constructor(
    public code: string,
    public message: string,
    public recovery?: string
  ) {
    super(message);
  }
}

// Usage
throw new PactError(
  'INSUFFICIENT_BALANCE',
  'Your wallet balance is too low',
  'Please add at least 15 ADA to your wallet and try again'
);
```

#### 2. Caching

**Current**: Re-fetch eligibility on every drawer open
**Future**: Cache eligibility results with TTL

```typescript
const ELIGIBILITY_CACHE_TTL = 60_000; // 1 minute

const eligibilityCache = new Map<string, {
  data: PactEligibility;
  timestamp: number;
}>();

export async function getCachedEligibility(wallet: BrowserWallet) {
  const address = await wallet.getChangeAddress();
  const cached = eligibilityCache.get(address);

  if (cached && Date.now() - cached.timestamp < ELIGIBILITY_CACHE_TTL) {
    return cached.data;
  }

  const data = await checkPactEligibility(wallet);
  eligibilityCache.set(address, { data, timestamp: Date.now() });
  return data;
}
```

#### 3. Loading States

**Current**: Single loading spinner
**Future**: Progressive loading with status messages

```typescript
const [loadingState, setLoadingState] = useState<{
  stage: 'idle' | 'fetching-address' | 'checking-drep' | 'checking-pact' | 'done';
  message: string;
}>({ stage: 'idle', message: '' });

// Update throughout loading process
setLoadingState({ stage: 'fetching-address', message: 'Getting wallet address...' });
setLoadingState({ stage: 'checking-drep', message: 'Checking DRep status...' });
setLoadingState({ stage: 'checking-pact', message: 'Checking PACT ownership...' });
```

#### 4. Transaction Status Tracking

**Current**: Alert on success/failure
**Future**: Track transaction status until confirmation

```typescript
async function trackTransaction(txHash: string) {
  let confirmed = false;
  let attempts = 0;

  while (!confirmed && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s

    const response = await fetch(
      `${BLOCKFROST_URL}/txs/${txHash}`,
      { headers: { project_id: BLOCKFROST_API_KEY } }
    );

    if (response.ok) {
      confirmed = true;
      return { confirmed: true, txHash };
    }

    attempts++;
  }

  return { confirmed: false, txHash };
}
```

#### 5. Multi-Language Support

**Current**: English only
**Future**: i18n support

```typescript
const translations = {
  en: {
    'pact.claim.button': '[ CLAIM - 10 ₳ ]',
    'pact.claim.success': 'PACT token claimed successfully!',
    'pact.eligibility.delegation': 'Delegation < 13M ₳:',
  },
  es: {
    'pact.claim.button': '[ RECLAMAR - 10 ₳ ]',
    'pact.claim.success': '¡Token PACT reclamado con éxito!',
    'pact.eligibility.delegation': 'Delegación < 13M ₳:',
  },
};
```

---

## Appendix

### Key Files Reference

| File Path | Purpose |
|-----------|---------|
| `block-vote-contracts/validators/pact_membership.ak` | Aiken smart contract |
| `block-vote/public/plutus.json` | Compiled validators |
| `block-vote/lib/transactions-pact.ts` | Transaction builder |
| `block-vote/lib/query-pact-token.ts` | Token detection |
| `block-vote/lib/query-drep.ts` | DRep eligibility |
| `block-vote/lib/governance-icon.ts` | SVG icons |
| `block-vote/lib/base64-chunker.ts` | Metadata chunking |
| `block-vote/lib/lucid-provider.ts` | Lucid initialization |
| `block-vote/components/ClaimPactDrawer.tsx` | Main UI component |
| `block-vote/components/PactDrawerButton.tsx` | Global button |

### External Resources

- **Cardano Preview Testnet Faucet**: https://docs.cardano.org/cardano-testnet/tools/faucet/
- **Blockfrost API Docs**: https://docs.blockfrost.io/
- **Aiken Documentation**: https://aiken-lang.org/
- **Lucid Evolution Docs**: https://github.com/Anastasia-Labs/lucid-evolution
- **CIP-25 Specification**: https://cips.cardano.org/cips/cip25/
- **Anastasia Labs Design Patterns**: https://github.com/Anastasia-Labs/aiken-design-patterns

### Environment Setup

```bash
# Required environment variables
NEXT_PUBLIC_BLOCKFROST_PREVIEW_API_KEY=preview...
NEXT_PUBLIC_CARDANO_NETWORK=preview

# Install dependencies
cd block-vote
npm install

# Build Aiken contracts
cd ../block-vote-contracts
aiken build

# Copy plutus.json
cp plutus.json ../block-vote/public/

# Run development server
cd ../block-vote
npm run dev
```

### Network Configuration

**Preview Network**:
- Blockfrost URL: `https://cardano-preview.blockfrost.io/api/v0`
- Explorer: `https://preview.cardanoscan.io`
- Faucet: 10,000 test ADA per request

**Lucid Network Config**:
```typescript
const lucid = await Lucid(
  new Blockfrost('https://cardano-preview.blockfrost.io/api/v0', apiKey),
  'Preview'
);
```

---

## Document Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-10 | 1.0 | Initial MVP documentation |

---

**End of Document**
