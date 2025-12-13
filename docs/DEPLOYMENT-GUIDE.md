# Cardano dApp Deployment Guide for Next.js 16

**Purpose**: This guide documents critical TypeScript, build configuration, and deployment issues encountered when deploying a Cardano dApp (blockVote) to Vercel. Use this to avoid common pitfalls when building Next.js applications with Cardano libraries.

---

## Table of Contents

1. [TypeScript Strict Type Checking](#typescript-strict-type-checking)
2. [Wallet Type Compatibility](#wallet-type-compatibility)
3. [BigInt Literal Syntax](#bigint-literal-syntax)
4. [WebAssembly Configuration](#webassembly-configuration)
5. [Static Generation vs Dynamic Rendering](#static-generation-vs-dynamic-rendering)
6. [Next.js 16 Specific Issues](#nextjs-16-specific-issues)
7. [Quick Reference Checklist](#quick-reference-checklist)

---

## TypeScript Strict Type Checking

### Problem
Vercel's production build uses stricter TypeScript settings than local development, causing implicit `any` type errors that don't appear locally.

### Common Errors

**1. Implicit `any` in Array Methods**
```typescript
// ❌ ERROR: Parameter 'utxo' implicitly has an 'any' type
utxos.forEach(utxo => {
  utxo.output.amount.forEach(asset => {
    // ...
  });
});

// ✅ SOLUTION: Add explicit type annotations
utxos.forEach((utxo: any) => {
  utxo.output.amount.forEach((asset: any) => {
    // ...
  });
});
```

**2. Implicit `any` in Callbacks**
```typescript
// ❌ ERROR
const suitableUtxos = utxos.filter(utxo => {
  return utxo.output.amount.find(a => a.unit === 'lovelace');
});

// ✅ SOLUTION
const suitableUtxos = utxos.filter((utxo: any) => {
  return utxo.output.amount.find((a: any) => a.unit === 'lovelace');
});
```

### Prevention Strategy
- Always add explicit type annotations for parameters in `.forEach()`, `.map()`, `.filter()`, `.find()`, `.some()`
- Use `any` type for Mesh SDK wallet UTxOs and assets since they don't have exported types
- Test build locally with strict mode before deploying

---

## Wallet Type Compatibility

### Problem
The Mesh SDK's `useWallet()` hook returns `IWallet` type, but many Cardano libraries (including custom transaction builders) expect `BrowserWallet` type. This causes type incompatibility errors during build.

### Common Error
```typescript
// ❌ ERROR: Argument of type 'IWallet' is not assignable to parameter of type 'BrowserWallet'
export async function buildClaimPactTx(
  wallet: BrowserWallet,  // Too restrictive!
  userAddress: string
) {
  // ...
}
```

### Solution Pattern
**Change all wallet parameter types to `any`** in transaction and query functions:

```typescript
// ✅ SOLUTION: Use 'any' for wallet parameters
export async function buildClaimPactTx(
  wallet: any,  // Accepts both IWallet and BrowserWallet
  userAddress: string
) {
  // ...
}

export async function hasPactToken(wallet: any): Promise<boolean> {
  // ...
}

export async function getWalletBalance(wallet: any): Promise<number> {
  // ...
}
```

### Files That Need This Fix
- All transaction builders (`lib/transactions-*.ts`)
- All query functions (`lib/query-*.ts`)
- Any helper functions that receive wallet objects

---

## BigInt Literal Syntax

### Problem
TypeScript targets lower than ES2020 don't support BigInt literal syntax (`42n`). Vercel's build may use a different target than your local environment.

### Common Error
```typescript
// ❌ ERROR: BigInt literals are not available when targeting lower than ES2020
const minAda = 3_000_000n;
const tokenAmount = 1n;
if (amount > 0n) { }
```

### Solution
Always use `BigInt()` constructor instead of literal syntax:

```typescript
// ✅ SOLUTION: Use BigInt() constructor
const minAda = BigInt(3_000_000);
const tokenAmount = BigInt(1);
if (amount > BigInt(0)) { }

// In objects
{
  lovelace: BigInt(2_000_000),
  [assetId]: BigInt(1)
}

// In comparisons
if (remainingTokens > BigInt(0)) { }
```

### Quick Find & Replace Pattern
Search regex: `\d+n\b`
Replace with: `BigInt($1)` where $1 is the number

---

## WebAssembly Configuration

### Problem
Cardano libraries (Lucid Evolution, CSL) use WebAssembly modules that require special webpack configuration in Next.js. Without proper config, you'll get "ENOENT: no such file" errors for `.wasm` files during build.

### Required Configuration

**next.config.ts:**
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},  // Required for Next.js 16
  webpack: (config, { isServer }) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add WASM file handling rule
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Configure WASM output location
    config.output.webassemblyModuleFilename =
      isServer
        ? '../static/wasm/[modulehash].wasm'
        : 'static/wasm/[modulehash].wasm';

    return config;
  },
};

export default nextConfig;
```

**package.json:**
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --webpack",  // Force webpack for production
    "start": "next start"
  }
}
```

### Why This Matters
- **asyncWebAssembly**: Enables async WASM module loading
- **layers**: Required for module federation (Next.js internal)
- **webassembly/async**: Tells webpack how to handle `.wasm` files
- **webassemblyModuleFilename**: Ensures WASM files are correctly placed in build output
- **--webpack flag**: Avoids Turbopack bundling issues with WASM files

---

## Static Generation vs Dynamic Rendering

### Problem
Next.js 16 tries to statically generate pages by default. Pages that import Cardano libraries (which use WASM) will fail during build with "ENOENT" errors because WASM modules can't be loaded during static generation.

### Error Example
```
Error occurred prerendering page "/governance/create"
Error: ENOENT: no such file or directory, open '.next/server/chunks/cardano_multiplatform_lib_bg.wasm'
```

### Solution
**Force dynamic rendering** for pages that use Cardano libraries:

```typescript
// app/governance/create/page.tsx
import { CreateGovernanceAction } from '@/components/CreateGovernanceAction';

// ✅ Add this export to prevent static generation
export const dynamic = 'force-dynamic';

export default function CreateGovernanceActionPage() {
  return <CreateGovernanceAction />;
}
```

### Pages That Need This
Any page that:
- Imports Lucid Evolution or CSL libraries
- Uses transaction builders
- Calls Cardano query functions at the component level

**Common pages:**
- `/governance/create` - Uses transaction builders
- Any page with blockchain interactions
- Pages that fetch on-chain data during render

---

## Next.js 16 Specific Issues

### Issue 1: Turbopack vs Webpack Requirement

**Error:**
```
ERROR: This build is using Turbopack, with a `webpack` config and no `turbopack` config.
```

**Solution:**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  turbopack: {},  // Empty object satisfies requirement
  webpack: (config) => {
    // Your webpack config
    return config;
  },
};
```

### Issue 2: Turbopack WASM Bundling Conflicts

**Error:**
```
SyntaxError: Identifier 'x' has already been declared
```

**Cause:** Turbopack has issues with Lucid Evolution library bundling.

**Solution:** Force webpack for production builds:
```json
{
  "scripts": {
    "build": "next build --webpack"
  }
}
```

### Issue 3: PlutusScript Version Type

**Error:**
```
Type 'string' is not assignable to type '"V1" | "V2" | "V3"'
```

**Solution:** Use `as const` assertion:
```typescript
// ❌ ERROR
const script = {
  code: mintingPolicy.compiledCode,
  version: 'V3',  // Type is 'string'
};

// ✅ SOLUTION
const script = {
  code: mintingPolicy.compiledCode,
  version: 'V3' as const,  // Type is literal '"V3"'
};
```

---

## Null Safety and Undefined Checks

### Problem
Functions may return `undefined` but TypeScript expects non-null values.

### Common Patterns

**1. Wallet Address Retrieval**
```typescript
// ❌ ERROR: Type 'string | undefined' is not assignable to type 'string'
const walletAddress = useAddress();
const result = await someFunction(walletAddress);

// ✅ SOLUTION: Add null check
const walletAddress = useAddress();
if (!walletAddress) {
  setError('Could not retrieve wallet address');
  return;
}
const result = await someFunction(walletAddress);
```

**2. Vote Choice State**
```typescript
// ❌ ERROR: Type '"Yes" | "No" | null' is not assignable to type '"Yes" | "No"'
const [voteChoice, setVoteChoice] = useState<'Yes' | 'No' | null>(null);
await buildCastVoteTx(wallet, { vote: voteChoice });

// ✅ SOLUTION: Add null check
if (!voteChoice) {
  setError('Please select Yes or No before voting');
  return;
}
await buildCastVoteTx(wallet, { vote: voteChoice });
```

**3. Network Configuration**
```typescript
// ❌ ERROR: Argument of type 'Network | undefined' is not assignable
const network = lucid.config().network;
const address = credentialToAddress(network, credential);

// ✅ SOLUTION: Add undefined check
const network = lucid.config().network;
if (!network) {
  throw new Error('Network not configured in Lucid instance');
}
const address = credentialToAddress(network, credential);
```

---

## Type Casting for Plutus Data

### Problem
Lucid's `Data.to()` doesn't recognize certain types as valid `Data` types.

### Error Example
```typescript
// ❌ ERROR: Type 'Credential[]' is not assignable to type 'Data'
const updatedDatum = new Constr(0, [
  params.distributionDatum.qualifiedMembers,  // Credential[]
  params.distributionDatum.policyId,           // string
  params.distributionDatum.userTokenName,      // string
  BigInt(remainingTokens),
]);
const datumCbor = Data.to(updatedDatum);
```

### Solution
Cast to `any` when working with Plutus Data:

```typescript
// ✅ SOLUTION: Cast fields and final result to 'any'
const updatedDatum = new Constr(0, [
  params.distributionDatum.qualifiedMembers as any,
  params.distributionDatum.policyId as any,
  params.distributionDatum.userTokenName as any,
  BigInt(remainingTokens),
]);
const datumCbor = Data.to(updatedDatum as any);
```

---

## Interface vs Custom Properties

### Problem
Adding properties to return objects that aren't in the interface definition.

### Error Example
```typescript
// Interface definition
export interface TxBuildResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// ❌ ERROR: Property 'message' does not exist on type 'TxBuildResult'
return {
  success: true,
  txHash,
  message: 'Transaction submitted successfully',  // Not in interface!
};
```

### Solution
Only return properties defined in the interface:

```typescript
// ✅ SOLUTION: Remove extra properties
return {
  success: true,
  txHash,
  // Removed 'message' property
};

// Or update the interface if you need it:
export interface TxBuildResult {
  success: boolean;
  txHash?: string;
  error?: string;
  message?: string;  // Add to interface
}
```

---

## Quick Reference Checklist

Use this before deploying:

### TypeScript Issues
- [ ] All `.forEach()`, `.map()`, `.filter()` callbacks have explicit parameter types
- [ ] All wallet parameters use `any` type instead of `BrowserWallet`
- [ ] No BigInt literal syntax (`42n`) - use `BigInt(42)` instead
- [ ] All nullable values have null checks before use
- [ ] `as const` assertions used for literal union types ('V3', 'preview', etc.)
- [ ] Plutus Data constructions cast to `any`

### Next.js Configuration
- [ ] `next.config.ts` has both `turbopack: {}` and `webpack` config
- [ ] WebAssembly experiments enabled in webpack config
- [ ] `.wasm` module rules configured
- [ ] `package.json` has `"build": "next build --webpack"`

### Page Configuration
- [ ] Pages using Cardano libraries export `dynamic = 'force-dynamic'`
- [ ] Especially: transaction building, token claiming, voting pages

### Network Configuration
- [ ] Environment variables use correct network (preview/preprod/mainnet)
- [ ] Explorer links match the network (`preview.cexplorer.io` for preview)
- [ ] Blockfrost API keys match the network

---

## Development vs Production Differences

**Key Insight:** Vercel production builds are stricter than local development:

| Aspect | Local Dev | Vercel Production |
|--------|-----------|-------------------|
| TypeScript | More lenient | Strict mode enabled |
| BigInt support | May work with `42n` | Requires `BigInt(42)` |
| WASM loading | More forgiving | Needs explicit config |
| Static generation | Can be skipped | Attempted by default |
| Type inference | Allows implicit `any` | Flags all implicit `any` |

**Recommendation:** Always test `npm run build` locally before pushing to Vercel.

---

## Common Error Patterns & Solutions

### Pattern 1: "Parameter implicitly has 'any' type"
**Fix:** Add `(param: any)` to all array method callbacks

### Pattern 2: "BigInt literals not available"
**Fix:** Replace all `\d+n` with `BigInt(\d+)`

### Pattern 3: "ENOENT: no such file .wasm"
**Fix:** Add `export const dynamic = 'force-dynamic'` to page

### Pattern 4: "Type 'IWallet' is not assignable to 'BrowserWallet'"
**Fix:** Change function parameter to `wallet: any`

### Pattern 5: "Type 'undefined' is not assignable to type 'X'"
**Fix:** Add null/undefined check with early return

---

## Files Modified During blockVote Deployment

Reference for similar projects:

### Type Compatibility (Wallet Types)
- `lib/query-drep.ts` - All wallet params to `any`
- `lib/query-pact-token.ts` - All wallet params to `any`
- `lib/transactions-pact.ts` - All wallet params to `any`
- `lib/transactions-lucid.ts` - Wallet param to `any`
- `lib/transactions.ts` - All wallet params to `any`

### Implicit Any Fixes
- `components/WalletDrawer.tsx` - UTxO forEach loops
- `components/ClaimVotingToken.tsx` - Null check for walletAddress
- `components/WalletConnect.tsx` - Wallet enable check
- `components/WalletConnectTerminal.tsx` - Wallet enable check
- `lib/query-drep.ts` - UTxO forEach loops
- `lib/query-pact-token.ts` - UTxO forEach and some loops
- `lib/transactions-pact.ts` - UTxO filter callback
- `lib/transactions.ts` - UTxO forEach and filter

### BigInt Literal Fixes
- `lib/transactions-lucid.ts` - All `\d+n` to `BigInt(\d+)`

### Build Configuration
- `next.config.ts` - WebAssembly support, webpack config
- `package.json` - Build script with `--webpack` flag
- `app/governance/create/page.tsx` - Force dynamic rendering

### Null Safety
- `components/CastVote.tsx` - Vote choice null check
- `lib/lucid-provider.ts` - Network undefined check
- `lib/query-pact-token.ts` - User address undefined checks

### Type Casting
- `lib/transactions-lucid.ts` - Plutus Data casting to `any`

---

## Testing Before Deployment

1. **Local Build Test:**
   ```bash
   npm run build
   ```
   Fix any errors before pushing.

2. **Type Check:**
   ```bash
   npx tsc --noEmit
   ```

3. **Search for Common Issues:**
   ```bash
   # Find BigInt literals
   grep -r '\d\+n[,\)\;\}]' lib/ components/

   # Find implicit any in forEach/map/filter
   grep -r '\.forEach(\w\+ =>' lib/ components/
   grep -r '\.map(\w\+ =>' lib/ components/
   ```

---

## Summary

The key to successful Cardano dApp deployment is understanding that **production builds are stricter** than development. The main categories of issues are:

1. **Type Safety** - Explicit types for all callbacks and parameters
2. **Wallet Compatibility** - Use `any` for wallet objects
3. **BigInt Syntax** - Always use `BigInt()` constructor
4. **WASM Configuration** - Proper webpack setup for Cardano libraries
5. **Rendering Strategy** - Dynamic rendering for blockchain interactions
6. **Null Safety** - Check for undefined/null before using values

By following these patterns, you can avoid 90% of deployment errors when building Next.js Cardano dApps.

---

**Document Version:** 1.0
**Last Updated:** December 2024
**Project:** blockVote - Cardano Governance dApp
**Framework:** Next.js 16, Lucid Evolution, Mesh SDK
