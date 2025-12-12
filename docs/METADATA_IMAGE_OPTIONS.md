# Metadata Image Options for Lucid Evolution

A guide to including images in CIP-25 metadata while respecting Lucid Evolution's 64-character string limit.

---

## The Problem

Lucid Evolution enforces a **64-character limit on ALL string values** in metadata. This means:

❌ **Single string data URI**: ~1,500 characters - REJECTED
```typescript
{
  image: "data:image/svg+xml;base64,PHN2Zy..." // ❌ Too long!
}
```

## The Solutions

### Option 1: Chunked Base64 Array ✅

Split the data URI into an array of ≤64 character strings.

**How it works:**
```typescript
// Instead of a single long string
image: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0i..." // 1,500 chars ❌

// Use an array of short strings
image: [
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9",  // 64 chars ✅
  "IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4",  // 64 chars ✅
  "KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iY2FyZGFub0J",  // 64 chars ✅
  // ... more chunks
]
```

**Wallets concatenate the chunks** to reconstruct the full image.

**Usage:**
```typescript
import { buildTokenMetadata } from '@/lib/metadata';

const metadata = buildTokenMetadata(
  policyId,
  assetName,
  governanceData,
  {
    includeImage: true,  // ✅ Embeds as chunked array
  }
);

// Result:
{
  "721": {
    "fc74b202...": {
      "001bc280...": {
        "name": "Governance Token",
        "image": [
          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9",
          "IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4",
          // ... 24 total chunks
        ],
        "mediaType": "image/svg+xml"
      }
    }
  }
}
```

**Pros:**
- ✅ Works with Lucid Evolution
- ✅ Self-contained (no external dependencies)
- ✅ Guaranteed to display in supporting wallets

**Cons:**
- ❌ Larger metadata (~1.5KB for SVG)
- ❌ Higher transaction fees (~0.066 ADA extra)
- ❌ Not all wallets support chunked arrays
- ❌ Against CIP-25 recommendations

**When to use:**
- Testing/development
- When IPFS isn't available
- When you need guaranteed image presence in the transaction

---

### Option 2: IPFS URL (RECOMMENDED) ✅

Upload image to IPFS once, reference the hash in metadata.

**How it works:**
```typescript
// 1. Upload to IPFS (ONCE)
const cid = await nftStorage.storeBlob(svgBlob);
// Result: bafybeig3k2bn4qp8tmzkvy1jrccmkbns5chjhhm

// 2. Use IPFS URL in ALL mints
const metadata = buildTokenMetadata(
  policyId,
  assetName,
  governanceData,
  {
    imageIpfsUrl: `ipfs://${cid}`,  // 48 chars ✅
  }
);
```

**Result:**
```json
{
  "721": {
    "fc74b202...": {
      "001bc280...": {
        "name": "Governance Token",
        "image": "ipfs://bafybeig3k2bn4qp8tmzkvy1jrccmkbns5chjhhm",
        "mediaType": "image/svg+xml"
      }
    }
  }
}
```

**Pros:**
- ✅ Tiny metadata (~50 bytes)
- ✅ Low transaction fees
- ✅ Decentralized storage
- ✅ Follows CIP-25 best practices
- ✅ Excellent wallet/explorer support
- ✅ Reusable across unlimited mints
- ✅ Free with NFT.Storage

**Cons:**
- ❌ Requires one-time upload step
- ❌ Depends on IPFS network

**When to use:**
- **Production deployments** (RECOMMENDED)
- Long-term NFT projects
- When you want best practices

**Setup (5 minutes):**
```bash
# 1. Get free token from nft.storage
# Visit: https://nft.storage/

# 2. Upload your image
npm run upload-assets

# 3. Use the hash forever
```

---

### Option 3: No Image ✅

Omit the image field entirely.

**Usage:**
```typescript
const metadata = buildTokenMetadata(
  policyId,
  assetName,
  governanceData
  // No image options
);
```

**Result:**
```json
{
  "721": {
    "fc74b202...": {
      "001bc280...": {
        "name": "Governance Token",
        "description": "Voting token",
        // No image field
        "cardano_action_id": "...",
        "cardano_action_type": "InfoAction"
      }
    }
  }
}
```

**Pros:**
- ✅ Smallest possible transaction
- ✅ Lowest fees
- ✅ Simplest implementation
- ✅ Always works

**Cons:**
- ❌ Generic display in wallets
- ❌ No visual branding

**When to use:**
- MVP/testing
- Cost optimization
- When image isn't important

---

## Comparison

| Feature | Chunked Array | IPFS URL | No Image |
|---------|---------------|----------|----------|
| **Metadata size** | ~1,500 bytes | ~50 bytes | ~400 bytes |
| **Transaction cost** | +0.066 ADA | +0.002 ADA | Baseline |
| **Setup time** | None | 5 minutes | None |
| **Wallet support** | Some | Excellent | Perfect |
| **CIP-25 compliant** | No | Yes | Yes |
| **Reusability** | N/A | Unlimited | N/A |
| **Best for** | Testing | Production | MVP |

---

## Implementation Examples

### Example 1: Testing with Embedded Image

```typescript
import { buildTokenMetadata } from '@/lib/metadata';

const metadata = buildTokenMetadata(
  policyId,
  assetName,
  governanceData,
  {
    includeImage: true,  // Embed as chunked array
  }
);
```

### Example 2: Production with IPFS

```typescript
// Setup (run once)
import { NFTStorage } from 'nft.storage';

const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN });
const cid = await client.storeBlob(svgBlob);
console.log('IPFS CID:', cid); // bafybeig3k2bn4qp8tmzkvy1jrccmkbns5chjhhm

// Usage (every mint)
const metadata = buildTokenMetadata(
  policyId,
  assetName,
  governanceData,
  {
    imageIpfsUrl: `ipfs://${cid}`,
  }
);
```

### Example 3: MVP without Image

```typescript
const metadata = buildTokenMetadata(
  policyId,
  assetName,
  governanceData
  // No options = no image
);
```

---

## Cost Analysis

Based on your 1.1KB SVG:

### Per Transaction
```
No image:        0.155 ADA base
Chunked array:   0.221 ADA (+0.066 ADA)
IPFS URL:        0.157 ADA (+0.002 ADA)
```

### At Scale (1,000 mints)
```
No image:        155 ADA
Chunked array:   221 ADA (+66 ADA / ~$30 USD)
IPFS URL:        157 ADA (+2 ADA / ~$1 USD)
```

**IPFS is 33× cheaper at scale!**

---

## Wallet Support

### Chunked Arrays
- ✅ Eternl - Supported
- ✅ Nami - Supported
- ⚠️ Yoroi - Partial support
- ❓ Others - Varies

### IPFS URLs
- ✅ Eternl - Excellent
- ✅ Nami - Excellent
- ✅ Yoroi - Excellent
- ✅ All major wallets - Excellent
- ✅ Block explorers - Excellent

---

## Recommendation

**For Production: Use IPFS** 🏆

1. Upload your governance icon to NFT.Storage (once)
2. Use the IPFS hash in all mints
3. Enjoy low fees, excellent support, and best practices

**For Testing: Use Chunked Array**

1. Enable `includeImage: true` in metadata options
2. Test locally without IPFS setup
3. Switch to IPFS before production

**For MVP: No Image**

1. Omit image options
2. Add later when ready

---

## Quick Start

```typescript
// lib/transactions-lucid.ts

const metadata = buildTokenMetadata(
  actualPolicyId,
  userTokenName,
  {
    title: truncatedTitle,
    description: truncatedDescription,
    // ... other fields
  },
  {
    // OPTION 1: Chunked embedded (testing)
    includeImage: true,

    // OPTION 2: IPFS (production) - RECOMMENDED
    // imageIpfsUrl: 'ipfs://bafybeig3k2bn4qp8tmzkvy1jrccmkbns5chjhhm',

    // OPTION 3: No image (MVP)
    // (omit both)
  }
);
```

---

## Resources

- **NFT.Storage**: https://nft.storage/ (free IPFS pinning)
- **CIP-25 Standard**: https://cips.cardano.org/cip/CIP-25
- **IPFS Docs**: https://docs.ipfs.tech/
- **Base64 Chunking Utility**: `/lib/base64-chunker.ts`

---

*Last updated: 2024-12-08*
