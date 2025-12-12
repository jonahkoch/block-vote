# Mesh SDK Diagnostics

## Purpose

This diagnostic suite incrementally tests Mesh SDK functionality to identify exactly where transaction building fails with Plutus V3 scripts.

## What We Know

- ✅ Simple ADA transfer works (confirmed)
- ❌ Full CREATE PACT transaction fails with "UTxO Balance Insufficient"
- Network configuration is correct (PreProd)
- Collateral is set
- Wallet has 9,649 ADA available
- Metadata size is reasonable (1.94KB)

## Test Suite

### Test 1: Simple ADA Transfer (Baseline)
**What it does:** Sends 2 ADA to own address
**Expected:** ✅ PASS
**Purpose:** Confirms basic Mesh SDK functionality works

### Test 2: Mint Token Only
**What it does:** Mints 1 token with Plutus V3 script, no outputs
**Expected:** ? (this is the first real test)
**Purpose:** Tests if Plutus V3 minting works in isolation

### Test 3: Mint + Send to Wallet
**What it does:** Mints 1 token and sends to own wallet address
**Expected:** ?
**Purpose:** Tests minting + sending to regular (non-script) address

### Test 4: Mint CIP-068 Dual Tokens
**What it does:** Mints reference token (label 100) + 3 user tokens (label 222), sends both to wallet
**Expected:** ?
**Purpose:** Tests the CIP-068 dual token pattern we need for BlockVote

### Test 5: Mint + Metadata
**What it does:** Mints token with minimal CIP-25 metadata
**Expected:** ?
**Purpose:** Tests if metadata is causing the issue

## Running Tests

1. Navigate to http://localhost:3000/diagnostics
2. Connect your wallet
3. Open browser console (F12) for detailed logs
4. Run tests individually or all at once
5. Check console for pass/fail and error messages

## What This Tells Us

Each test that **passes** confirms that feature works.
The **first test that fails** is where Mesh SDK breaks.

### Possible Outcomes

1. **Test 2 fails:** Mesh SDK cannot handle Plutus V3 minting at all
2. **Test 2 passes, Test 3 fails:** Minting works but combining with outputs fails
3. **Test 3 passes, Test 4 fails:** Issue is with CIP-068 dual tokens specifically
4. **Test 4 passes, Test 5 fails:** Metadata is the problem (unlikely based on size)
5. **All pass:** The issue is specific to sending tokens to **script addresses** (not tested here yet)

## Next Steps Based on Results

Share the test results in Mesh SDK Discord with:
- Which test failed
- The exact error message
- Browser console logs
- The fact that simpler tests passed

This will help the Mesh team pinpoint whether it's:
- A Plutus V3 support issue
- A UTxO selection bug
- A fee calculation problem
- A network configuration issue

## Files Created

- `/lib/diagnostics.ts` - Test implementations
- `/app/diagnostics/page.tsx` - Test UI
- `DIAGNOSTICS.md` - This documentation

**Note:** These files are completely separate from your production code and won't affect the main CREATE PACT flow.
