# PACT Token System

## Current Implementation (MVP)

### What Works Now ✅

1. **Claim PACT Token**
   - Cost: 10 ADA
   - User gets PACT membership NFT
   - NFT has cyan "P" icon
   - Unique per user (based on address hash)

2. **Burn PACT Token**
   - Returns: 9 ADA (from user's own wallet)
   - Destroys PACT NFT
   - User needs 9 ADA in wallet to burn
   - Burn button appears for ANY PACT token (detects by name)

3. **Token Detection**
   - Checks wallet for token with matching name pattern
   - Works regardless of when token was minted
   - Name = Blake2b-256 hash of user's address

### How It Works

**Minting:**
```
User pays 10 ADA
├─ Mint PACT NFT (parameterized by UTxO)
├─ Unique policy ID per user
├─ Token name = hash(user address)
└─ Metadata with cyan P icon
```

**Burning:**
```
User burns PACT NFT
├─ Query Blockfrost for original minting UTxO
├─ Reconstruct parameterized script
├─ Burn NFT (quantity = -1)
└─ Return 9 ADA from user's wallet
```

### MVP Limitations ⚠️

1. **Not a true deposit system**
   - The 10 ADA is NOT locked at a script
   - Frontend enforces the 10 ADA cost
   - Burn returns 9 ADA from user's own wallet (not a script)

2. **User must have 9 ADA to burn**
   - Not ideal UX
   - The 9 ADA doesn't come from a "locked deposit"

3. **No deposit guarantee**
   - If user spends all their ADA, they can't burn
   - The original 10 ADA isn't "locked" anywhere

## Future Implementation (Script Address)

### What Will Change 🚀

1. **Proper Deposit Locking**
   - When minting: 9 ADA sent to script address
   - Script address controlled by validator code
   - **NO seed phrase needed!**

2. **True Redemption**
   - When burning: 9 ADA unlocked from script
   - Validator checks NFT is being burned
   - User always gets their 9 ADA back

3. **Better Security**
   - Deposits safe even if frontend offline
   - Validator code is the "key" (not a seed phrase)
   - Transparent and verifiable on-chain

### How Script Addresses Work

**Key Concept:** Script addresses have NO seed phrase!

```
Regular Wallet:
Address: addr1q...
Control: Seed phrase → Private key
Access: Anyone with seed phrase

Script Address:
Address: addr1w...
Control: Validator code (Plutus script)
Access: ONLY transactions that satisfy validator logic
```

### Script Address Flow

**Minting with Deposit:**
```
User pays 10 ADA
├─ Mint PACT NFT (pact_membership.ak)
├─ Send 9 ADA to script address (pact_deposit.ak)
│   └─ Datum: {policyId, tokenName}
└─ ~1 ADA to fees
```

**Burning with Redemption:**
```
User burns PACT NFT
├─ Find deposit UTXO at script (matching datum)
├─ Burn PACT NFT (quantity = -1)
├─ Validator checks: NFT being burned? ✓
└─ Unlock 9 ADA from script → User wallet
```

### Security Questions Answered

**Q: Who controls the script address?**
- A: The validator CODE controls it, not a person!

**Q: Can someone steal the deposits?**
- A: No! The validator checks the specific NFT is being burned

**Q: What if the frontend goes offline?**
- A: Deposits are safe! Anyone can build a burn transaction

**Q: How do we access the 9 ADA without a seed phrase?**
- A: The validator code defines when funds can be unlocked:
  ```aiken
  // Only unlock if this specific NFT is burned
  let burned = quantity_of(tx.mint, datum.policy_id, datum.token_name)
  burned == -1  // Returns true only when NFT burned
  ```

## Implementation Files

### Current MVP
- `/lib/transactions-pact.ts` - Build mint/burn transactions
- `/lib/query-pact-token.ts` - Detect PACT tokens by name
- `/components/ClaimPactDrawer.tsx` - UI for claim/burn
- `/validators/pact_membership.ak` - Minting policy with burn support

### Future Script Address (Not Yet Active)
- `/validators/pact_deposit.ak` - Deposit validator (designed, not deployed)
- `/PACT_DEPOSIT_ARCHITECTURE.md` - Full implementation guide

## Migration Plan

When upgrading to script address system:

1. **No breaking changes**
   - Old PACT tokens continue to work (MVP burn logic)
   - New PACT tokens use script deposits (V2 burn logic)
   - Frontend auto-detects version

2. **Backward compatible**
   ```typescript
   const version = await getPactVersion(policyId);
   if (version === 'mvp') {
     // Burn from user wallet
   } else {
     // Unlock from script address
   }
   ```

3. **Gradual migration**
   - Deploy pact_deposit validator
   - Update frontend to use script for new claims
   - Keep MVP logic for old tokens
   - Eventually all tokens will be V2

## Key Takeaways

### Current MVP ✅
- Simple burn returns 9 ADA from user's wallet
- Works for any PACT token (detects by name)
- Frontend enforces 10 ADA cost
- Fast to implement, good for testing

### Future V2 🚀
- True deposit system with script address
- 9 ADA locked at script (no seed phrase!)
- Validator code controls access
- More secure, better UX
- Fully decentralized

## Technical Details

### Token Name Generation
```typescript
// Ensures unique PACT per user
function generatePactTokenName(address: string): string {
  const hash = blake2b(address, 32);  // 32 bytes = 256 bits
  return hash.toString('hex');        // 64 hex chars
}
```

### Parameterized Minting Policy
```
Each PACT token has unique policy ID:
Policy ID = hash(validator_code + utxo_ref)

Same validator code + different UTxO = different policy ID
This ensures one-time minting (UTxO can only be spent once)
```

### Burn Detection
```typescript
// Find PACT token regardless of policy ID
const expectedName = generatePactTokenName(userAddress);
const hasPact = utxos.some(utxo =>
  utxo.assets.some(asset =>
    asset.unit.substring(56) === expectedName  // Last 64 chars = name
  )
);
```

## References

- Smart Contract: `/block-vote-contracts/validators/pact_membership.ak`
- Deposit Design: `/block-vote-contracts/validators/pact_deposit.ak`
- Architecture Doc: `/block-vote-contracts/PACT_DEPOSIT_ARCHITECTURE.md`
- Transaction Builders: `/lib/transactions-pact.ts`
- Token Detection: `/lib/query-pact-token.ts`
