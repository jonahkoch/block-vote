# Querying Real Governance PACTs

**Status**: 🟡 Partially Implemented
**Date**: 2024-12-09

---

## Overview

The governance page now queries the blockchain for real created PACTs instead of showing only mock data.

## What's Working

✅ **Blockfrost Integration**
- Queries UTxOs at Metadata Validator address
- Uses existing Blockfrost API key from `.env.local`
- Graceful fallback to mock data if query fails

✅ **Automatic Loading**
- Page automatically queries on load
- "REFRESH" button re-queries blockchain
- Console logs show what's happening

✅ **Smart Fallback**
- If Blockfrost configured → queries real PACTs
- If real PACTs found → displays them
- Otherwise → shows mock data for development

## What's NOT Working Yet

❌ **Datum Decoding**
- Currently returns empty array because datums aren't decoded yet
- Need to implement CBOR decoding for `GovernancePactDatum`
- This is the main blocker

❌ **Vote Counting**
- Don't yet query Voting Validator for current votes
- Shows 0 votes for all PACTs

❌ **Transaction Timestamps**
- Don't fetch tx creation time
- Shows epoch 0 for createdAt

---

## How It Works

### 1. Query Metadata Validator UTxOs

```typescript
// lib/query-pacts.ts
export async function queryMetadataValidatorUTxOs() {
  const metadataAddress = scriptHashToAddress(METADATA_VALIDATOR_HASH);

  const response = await fetch(
    `${BLOCKFROST_URL}/addresses/${metadataAddress}/utxos`,
    {
      headers: { 'project_id': BLOCKFROST_API_KEY },
    }
  );

  return await response.json();
}
```

### 2. Decode Each Datum (TODO)

```typescript
function decodePactDatum(datum: any) {
  // TODO: Implement proper CBOR decoding
  // Need to decode inline_datum field from UTxO
  // Should return GovernancePactDatum structure
  return null;
}
```

### 3. Build Governance Action Objects

```typescript
for (const utxo of utxos) {
  const pactData = decodePactDatum(utxo.inline_datum);

  const action: GovernanceAction = {
    id: `${utxo.tx_hash}#${utxo.output_index}`,
    title: pactData.title,
    description: pactData.description,
    votingDeadline: pactData.votingDeadline,
    // ... etc
  };

  pacts.push(action);
}
```

---

## Testing

### Current Behavior

1. **Navigate to `/governance`**
2. **Check console**:
   ```
   Querying real governance PACTs from blockchain...
   Querying Metadata Validator address: addr_test1w...
   Found 0 UTxOs at Metadata Validator
   Using mock data for development
   ```

3. **See mock data** (because no datums decoded yet)

### When Real PACTs Created

Once you create PACTs with the "CREATE GOVERNANCE PACT" button:
1. PACTs are sent to Metadata Validator address
2. Blockfrost query will find those UTxOs
3. Console will show: `Found X UTxOs at Metadata Validator`
4. BUT still shows mock data until datum decoding implemented

---

## Next Steps to Complete

### Priority 1: Implement Datum Decoding

**Need to**:
1. Decode CBOR from `utxo.inline_datum`
2. Parse into `GovernancePactDatum` structure
3. Extract: title, description, votingDeadline, etc.

**Approaches**:
- Use `@emurgo/cardano-serialization-lib` for CBOR decoding
- Or use Lucid's `Data.from()` method
- Match the exact Plutus data structure

**Example datum structure** (from contracts):
```typescript
{
  title: string,
  description: string,
  cardanoActionId: string,
  cardanoActionType: string,
  votingDeadline: number, // POSIX timestamp
  totalMembers: number,
  requiredVotes: number,
  policyId: string, // script hash
  assetName: string, // hex
  metadataValidator: string,
  distributionValidator: string,
}
```

### Priority 2: Query Vote Counts

**Need to**:
1. Query Voting Validator address for UTxOs
2. Count UTxOs with matching `refTokenUnit`
3. Each UTxO represents 1 vote
4. Sum up total current votes

**Implementation**:
```typescript
async function queryVoteCount(refTokenUnit: string): Promise<number> {
  // Query Voting Validator address
  // Filter UTxOs containing refTokenUnit
  // Return count
}
```

### Priority 3: Get Transaction Timestamps

**Need to**:
1. Query transaction details from Blockfrost
2. Extract `block_time` field
3. Convert to POSIX timestamp
4. Set as `createdAt`

**Blockfrost endpoint**:
```
GET /txs/{hash}
Response: { block_time: 1234567890, ... }
```

---

## Files Created/Modified

### New Files
- ✅ `/lib/query-pacts.ts` - Blockchain query logic
- ✅ `/docs/QUERYING_REAL_PACTS.md` - This document

### Modified Files
- ✅ `/components/GovernanceActionList.tsx` - Now queries real PACTs
- ✅ No changes to `.env.local` - already has Blockfrost key

---

## Configuration

**Environment Variables** (already configured in `.env.local`):
```bash
NEXT_PUBLIC_BLOCKFROST_PREPROD_API_KEY=preprod0AYRllsavZ0C1K1TRxzIxcb3EQkSDJsB
```

**Validator Addresses** (from `lib/contracts.ts`):
- Metadata Validator: `METADATA_VALIDATOR_HASH`
- Voting Validator: `VOTING_VALIDATOR_HASH` (not queried yet)
- Distribution Validator: `DISTRIBUTION_VALIDATOR_HASH` (not needed for display)

---

## Example: What Real Data Will Look Like

Once datum decoding is working, you'll see:

```typescript
{
  id: "8f54d021c6e6fcdd5a4908f10a7b092fa31cd94db2e809f2e06d7ffa4d78773d#0",
  title: "Test Governance Pact",
  description: "This is a test pact for development",
  createdAt: 1733775395000, // From tx block_time
  votingDeadline: 1733835092000, // From pact datum
  totalMembers: 3, // From pact datum
  requiredVotes: 2, // From pact datum
  currentVotes: 0, // From Voting Validator query
  status: "active",
  refTokenUnit: "fc74b202751b95288869bddd1c55ed554f79238bcc264b104e5d1cd4001bc280626c6f636b566f74655061637431373335373735333935"
}
```

---

## Troubleshooting

### "Blockfrost not configured"
- Check `.env.local` has `NEXT_PUBLIC_BLOCKFROST_PREPROD_API_KEY`
- Restart dev server after adding env var

### "Found 0 UTxOs at Metadata Validator"
- This is normal if no PACTs created yet
- Create a PACT using "CREATE GOVERNANCE PACT" button
- Wait for transaction to confirm (~20 seconds)
- Click "REFRESH" button

### "Failed to load real PACTs, falling back to mock data"
- Check console for actual error
- Likely Blockfrost API issue or network error
- Mock data will still work for development

### Real PACTs created but still showing mock data
- This is expected! Datum decoding not implemented yet
- Console will show: `Found X UTxOs but failed to decode datums`
- This is Priority 1 to fix

---

## API Reference

### `queryMetadataValidatorUTxOs()`
Queries all UTxOs at Metadata Validator address.

**Returns**: Array of Blockfrost UTxO objects

**Example Response**:
```json
[
  {
    "tx_hash": "8f54d021...",
    "output_index": 0,
    "amount": [
      { "unit": "lovelace", "quantity": "3000000" },
      { "unit": "fc74b202...001bc280...", "quantity": "1" }
    ],
    "inline_datum": "d8799f4a5465...",
    "data_hash": null
  }
]
```

### `queryGovernancePacts()`
Main function to get all governance PACTs.

**Returns**: `Promise<GovernanceAction[]>`

**Status**: 🟡 Returns empty array until datum decoding implemented

---

## Related Documentation

- `/docs/DEVELOPMENT_CHECKLIST.md` - Safety guidelines
- `/docs/SESSION_2024-12-08_FIXES.md` - Recent fixes
- Blockfrost API Docs: https://docs.blockfrost.io

---

*Created: 2024-12-09*
*Status: Foundation in place, datum decoding needed*
