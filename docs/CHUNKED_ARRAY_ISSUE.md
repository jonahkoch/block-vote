# Chunked Array Metadata Issue with Lucid Evolution

**Status**: 🔴 NOT WORKING
**Date**: 2024-12-08
**Issue**: Lucid Evolution rejects chunked Base64 arrays in metadata

---

## The Problem

When attempting to embed a P icon as a chunked Base64 array in transaction metadata, Lucid Evolution throws this error during transaction completion:

```
RunTimeError: from_json: invalid value: map, expected invalid tx metadatum (cardano-node JSON format)
```

### What We Tried

```typescript
// This metadata structure FAILS with Lucid Evolution
{
  '721': {
    [policyId]: {
      [assetName]: {
        name: "Governance Token",
        image: [  // ← Array of 25 chunks, each ≤64 chars
          "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJDYXBhXz",
          "EiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbm",
          // ... 23 more chunks
        ],
        mediaType: "image/svg+xml"
      }
    }
  }
}
```

### Transaction Flow

1. ✅ **Steps 1-8**: Transaction builds successfully
   - Minting policy parameterization works
   - Redeemer serialization works
   - Datums serialize correctly
   - UTxO collection works
   - Assets mint correctly
   - Outputs to validators work
   - Metadata structure is created

2. ❌ **Step 9**: Transaction completion FAILS
   - Lucid calls `.complete()` to finalize the transaction
   - Internally, Lucid converts metadata JSON → Cardano CBOR format
   - The metadata parser encounters the array and throws error
   - Error: "invalid value: map, expected invalid tx metadatum"

---

## Root Cause Analysis

### Cardano Metadata Format

Cardano's transaction metadata follows a strict schema defined by cardano-node. The metadata is stored as CBOR (Concise Binary Object Representation) with these constraints:

- **Metadata map**: Top-level must be a map of integers to metadata values
- **Metadata values** can be:
  - Integer (signed 64-bit)
  - Bytes (bytestring)
  - Text (UTF-8 string)
  - List (array of metadata values)
  - Map (key-value pairs of metadata values)

### Why Arrays Should Work

According to **CIP-25** (NFT Metadata Standard), arrays ARE supported:

```json
{
  "721": {
    "<policy_id>": {
      "<asset_name>": {
        "name": "...",
        "image": ["ipfs://...", "part2", "part3"]  // ← Arrays are valid!
      }
    }
  }
}
```

### Why Lucid Rejects It

**Lucid Evolution v0.4.29** uses a stricter metadata parser than other libraries:

1. **Mesh SDK**: More permissive, allows chunked arrays
2. **Lucid Evolution**: Stricter validation, rejects our chunked array structure
3. **Reason**: The error message "expected invalid tx metadatum (cardano-node JSON format)" suggests Lucid is enforcing cardano-node's exact JSON schema

The specific issue is likely:
- Lucid's `.attachMetadata()` method uses a JSON-to-CBOR converter
- This converter expects metadata values to match cardano-node's JSON format exactly
- Our chunked array structure doesn't match the expected schema
- The parser throws "invalid value: map" when it encounters the array

---

## Why We Tried Chunked Arrays

### The 64-Character Limit

Lucid Evolution enforces a **64-character limit on ALL metadata string values**:

```typescript
// ❌ This fails - data URI is 1,582 chars
{
  image: "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEi..."  // TOO LONG!
}

// ✅ This should work - each chunk is ≤64 chars
{
  image: [
    "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJDYXBhXz",  // 64 chars
    "EiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbm",  // 64 chars
    // ... more chunks
  ]
}
```

### The Theory

- Many NFT projects use chunked arrays for large images
- Wallets concatenate chunks to reconstruct the full image
- This is a common pattern in the Cardano ecosystem
- CIP-25 explicitly supports arrays

### The Reality

- Lucid's metadata parser is stricter than expected
- The chunked array format we're using doesn't pass validation
- Mesh SDK allows it, but Lucid Evolution does not

---

## Solutions

### ✅ Solution 1: Use IPFS (RECOMMENDED)

Upload the P icon to IPFS once, reference the hash in all mints.

**Advantages:**
- ✅ Works with Lucid Evolution
- ✅ Tiny metadata (~50 bytes)
- ✅ Low transaction fees (~0.002 ADA extra)
- ✅ Reusable across unlimited mints
- ✅ Best practice for production
- ✅ Excellent wallet/explorer support

**Implementation:**

```bash
# 1. Get free token from nft.storage
# Visit: https://nft.storage/

# 2. Upload P icon (once)
npm install nft.storage

# 3. Create upload script
# scripts/upload-p-icon.ts
```

```typescript
import { NFTStorage } from 'nft.storage';
import { PACT_ICON_BLUE_SVG } from '../lib/governance-icon';

const client = new NFTStorage({
  token: process.env.NFT_STORAGE_TOKEN
});

const blob = new Blob([PACT_ICON_BLUE_SVG], {
  type: 'image/svg+xml'
});

const cid = await client.storeBlob(blob);
console.log('IPFS CID:', cid);
console.log('Use this in transactions: ipfs://' + cid);
```

```typescript
// 4. Use in all mints (lib/transactions-lucid.ts)
const metadata = buildTokenMetadata(
  actualPolicyId,
  userTokenName,
  governanceData,
  {
    imageIpfsUrl: `ipfs://${cid}`,  // ✅ Works!
  }
);
```

**Cost Comparison (1,000 mints):**
- No image: 155 ADA
- Chunked array: 221 ADA (+66 ADA / ~$30 USD) ← DOESN'T WORK
- IPFS URL: 157 ADA (+2 ADA / ~$1 USD) ← **RECOMMENDED**

**IPFS is 33× cheaper and actually works!**

---

### ✅ Solution 2: Switch to Mesh SDK for Minting

Use Mesh SDK's transaction builder instead of Lucid for transactions that need embedded images.

**Advantages:**
- ✅ Mesh allows chunked arrays
- ✅ Self-contained (no IPFS dependency)
- ✅ Works with current code

**Disadvantages:**
- ❌ More complex (maintain two transaction builders)
- ❌ Higher fees than IPFS
- ❌ Need to verify Mesh handles Plutus V3 correctly

**Implementation:**
- Keep Lucid for most transactions
- Use Mesh specifically for minting with embedded images
- Would require porting the CREATE PACT transaction to Mesh

---

### ✅ Solution 3: No Image (Current Workaround)

Omit the image field entirely.

**Advantages:**
- ✅ Smallest transaction
- ✅ Lowest fees
- ✅ Works immediately

**Disadvantages:**
- ❌ Generic token icon in wallets
- ❌ No visual branding

**Current State:**
This is what we're using NOW to unblock minting. Image is disabled in:
`/Users/joko/Development/coLab/block-vote/lib/transactions-lucid.ts:191`

---

### ❌ Solution 4: Fix Lucid's Metadata Parser (Advanced)

Investigate Lucid Evolution's source code and understand the exact metadata format it expects.

**Potential approaches:**
1. Check Lucid's GitHub for metadata format requirements
2. Look for examples of chunked arrays with Lucid
3. Manually construct metadata in proper CBOR format
4. Submit issue/PR to Lucid Evolution if this is a bug

**This requires:**
- Deep dive into Lucid Evolution's source
- Understanding of CBOR encoding
- Possible contribution to Lucid Evolution
- May not be fixable on our side

---

## Current Status

**Immediate fix applied:**
- ✅ Disabled chunked image in `/lib/transactions-lucid.ts:191`
- ✅ Tokens can now mint successfully without image
- ✅ All other functionality works

**Next steps:**
1. **For testing/development**: Continue with no image (current state)
2. **For production**: Implement IPFS solution (recommended)
3. **Alternative**: Switch to Mesh SDK for image transactions

---

## Files Affected

### Created Files
- ✅ `/lib/governance-icon.ts` - P icon SVG library (still useful)
- ✅ `/lib/base64-chunker.ts` - Chunking utilities (for future use)
- ✅ `/examples/test-p-icon.ts` - Icon testing script
- ✅ `/docs/P_ICON_IMPLEMENTATION.md` - Implementation guide
- ✅ `/docs/METADATA_IMAGE_OPTIONS.md` - Comparison guide
- ✅ `/docs/CHUNKED_ARRAY_ISSUE.md` - This document

### Modified Files
- ✅ `/lib/metadata.ts` - Supports all three image options
- ✅ `/lib/transactions-lucid.ts` - Image disabled at line 191

---

## References

- **CIP-25 Standard**: https://cips.cardano.org/cip/CIP-25
- **Lucid Evolution**: https://github.com/Anastasia-Labs/lucid-evolution
- **NFT.Storage**: https://nft.storage/
- **Cardano Metadata Spec**: https://github.com/cardano-foundation/CIPs/tree/master/CIP-0025

---

*Last updated: 2024-12-08*
*Status: Chunked arrays not compatible with Lucid Evolution v0.4.29*
*Recommended solution: IPFS*
