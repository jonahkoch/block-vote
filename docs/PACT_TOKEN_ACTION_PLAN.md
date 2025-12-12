# PACT Token-Gating System - Action Plan

**Version:** 1.0
**Date:** 2024-12-09
**Status:** Planning Complete - Ready for Implementation

---

## Overview

The PACT (Participation And Consensus Token) is a membership NFT system that gates access to blockVotePact voting tokens. It ensures only qualified DReps can participate in governance voting.

### Key Features
- **Cost:** 10 ADA to claim
- **Redeemable:** 9 ADA (1 ADA fee) - Post-MVP
- **Token Type:** NFT (one per wallet, same policy ID, unique asset name)
- **Access Control:** Required to claim blockVotePact voting tokens
- **Blacklist Support:** Can be blacklisted to prevent redemption - Post-MVP

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│ [CLAIM PACT] Drawer                             │
├─────────────────────────────────────────────────┤
│ Wallet Information                               │
│  • Address: addr1...                             │
│  • Stake Address: stake1...                      │
│  • Balance: 45.3 ADA                            │
├─────────────────────────────────────────────────┤
│ DRep Status                                      │
│  • Status: ✓ Active / ✗ Inactive                │
│  • Delegation: 8.5M ADA                         │
│  • Threshold: ✓ PASS / ✗ FAIL                  │
├─────────────────────────────────────────────────┤
│ PACT Token Status                                │
│  • ✓ Claimed / ✗ Not Claimed                    │
│                                                  │
│  [CLAIM PACT TOKEN - 10 ADA]                    │
└─────────────────────────────────────────────────┘
```

---

## Threshold Requirements

Users must meet BOTH criteria to claim PACT token:

1. **Delegation Threshold:** < 13 million ADA delegated
   - Lovelace value: `< 13,000,000,000,000`
   - Purpose: Prevent large centralized DReps from participating

2. **Wallet Balance:** ≥ 10 ADA
   - Lovelace value: `≥ 10,000,000`
   - Purpose: Ensure user can afford the PACT token claim fee

---

## Token Design

### PACT NFT Specification
- **Policy ID:** Single policy for all PACT tokens
- **Asset Name:** Unique per wallet (hash of user's address)
- **Quantity:** 1 token per wallet (NFT)
- **Metadata:** CIP-25 compliant

### Why NFT (not fungible)?
- Ensures one PACT per wallet (uniqueness)
- Enables selective blacklisting of specific users
- Asset name = hash(owner_address) prevents duplicates

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Blockfrost API | DRep data queries | ✅ Configured |
| Mesh SDK | Wallet stake address, UTxO checking | ✅ Installed |
| Lucid Evolution | Transaction building | ✅ Installed |
| Aiken | Smart contract development | ✅ Installed |

---

## Implementation Phases

### Phase 1: DRep Data Queries & UI (MVP - Week 1)

**Goal:** Users can see their DRep status and eligibility

#### Tasks:

**1.1 Create DRep Query Library**
- **File:** `/lib/query-drep.ts`
- **Functions:**
  - `getStakeAddress(wallet)` - Extract stake address from wallet
  - `getDRepStatus(stakeAddress)` - Query Blockfrost for DRep registration
  - `getDelegationAmount(stakeAddress)` - Get controlled ADA amount
  - `checkPactEligibility(wallet)` - Validate both thresholds

**Blockfrost Endpoints:**
```
GET /accounts/{stake_address}
Response: {
  "stake_address": "stake1...",
  "active": true,
  "drep_id": "drep1..." | null,
  "controlled_amount": "8500000000000",  // lovelace
  ...
}
```

**1.2 Create ClaimPactDrawer Component**
- **File:** `/components/ClaimPactDrawer.tsx`
- **Displays:**
  - Wallet address (payment + stake)
  - Current wallet balance
  - DRep registration status (Active/Inactive)
  - Delegation amount in ADA
  - Threshold validation (PASS/FAIL indicators)
  - PACT token ownership status
  - Claim button (enabled/disabled based on eligibility)

**1.3 Update Header Component**
- **File:** `/components/Header.tsx`
- **Add:** [CLAIM PACT] button next to [WALLET]
- **Action:** Opens ClaimPactDrawer

**1.4 Mock PACT Token Check**
- **File:** `/lib/query-pact-token.ts`
- **Function:** `hasPactToken(wallet, policyId)` - Initially returns false
- **Purpose:** Placeholder for Phase 3 integration

**Deliverable:** Users can open drawer, see DRep info, and threshold validation

---

### Phase 2: PACT Smart Contract (MVP - Week 2)

**Goal:** Working smart contract for PACT minting with 10 ADA deposit

#### Tasks:

**2.1 Create PACT Membership Validator**
- **File:** `block-vote-contracts/validators/pact_membership.ak`
- **Type:** Combined Minting Policy + Spending Validator

**Datum Structure:**
```aiken
pub type PactMembershipDatum {
  owner: Address,           // Who owns this PACT token
  claimed_at: POSIXTime,    // When it was claimed
  deposit: Int,             // How much ADA locked (10,000,000 lovelace)
  blacklisted: Bool,        // Blacklist flag (for future use)
}
```

**Redeemers:**
```aiken
pub type PactMembershipRedeemer {
  ClaimPact           // Mint new PACT token (costs 10 ADA)
  RedeemDeposit       // Burn token, get 9 ADA back (POST-MVP)
  Blacklist           // Admin action to blacklist (POST-MVP)
}
```

**2.2 Implement Minting Logic (ClaimPact)**

**Validation Rules:**
1. ✓ Exactly 1 token minted
2. ✓ Token name = blake2b_256(owner_address) (ensures uniqueness)
3. ✓ 10 ADA (10,000,000 lovelace) sent to script address
4. ✓ Datum attached with:
   - Correct owner address
   - Current transaction timestamp
   - Deposit = 10,000,000
   - Blacklisted = False
5. ✓ Token minted to owner's address

**2.3 Build and Deploy**
```bash
cd block-vote-contracts
aiken build
aiken blueprint convert > plutus.json
```

**2.4 Extract Contract Hashes**
- Copy policy ID from compiled output
- Add to `/lib/contract-hashes.ts`

**Deliverable:** Deployed PACT minting contract on preprod

---

### Phase 3: Frontend Transaction Building (MVP - Week 3)

**Goal:** Users can claim PACT tokens through the UI

#### Tasks:

**3.1 Create PACT Transaction Builder**
- **File:** `/lib/transactions-pact.ts`

**Functions:**
```typescript
// Build claim PACT transaction
async function buildClaimPactTx(
  wallet: BrowserWallet,
  userAddress: string
): Promise<UnsignedTx>

// Check if user owns PACT token
async function hasPactToken(
  wallet: BrowserWallet,
  pactPolicyId: string
): Promise<boolean>

// Get PACT token details from wallet
async function getPactTokenInfo(
  wallet: BrowserWallet,
  pactPolicyId: string
): Promise<PactTokenInfo | null>
```

**3.2 Create PACT Datum Encoder**
- **File:** `/lib/plutus-data-pact.ts`

**Functions:**
```typescript
function pactMembershipDatumToData(
  datum: PactMembershipDatum,
  Constr: any
): Data

function claimPactRedeemerToData(Constr: any): Data
```

**3.3 Update ClaimPactDrawer**
- Wire up claim button to `buildClaimPactTx()`
- Handle transaction signing
- Show success/error messages
- Refresh drawer after successful claim

**3.4 Update PACT Token Check**
- Replace mock `hasPactToken()` with real implementation
- Query user's UTxOs for PACT policy ID
- Update drawer to show "✓ Claimed" when owned

**Deliverable:** Fully functional PACT claiming flow

---

### Phase 4: Token-Gate Integration (MVP - Week 3)

**Goal:** Require PACT token to claim blockVotePact voting tokens

#### Tasks:

**4.1 Update GovernanceActionDetail Component**
- **File:** `/components/GovernanceActionDetail.tsx`
- **Before "Claim Voting Token":**
  ```typescript
  const hasPact = await hasPactToken(wallet, PACT_POLICY_ID);
  if (!hasPact) {
    showError("You need a PACT membership token to claim voting tokens.");
    return;
  }
  ```

**4.2 Add Helpful UI Messages**
- Show PACT requirement clearly
- Provide link/button to open [CLAIM PACT] drawer
- Display user's PACT status on governance detail pages

**4.3 Update Distribution Transaction**
- **File:** `/lib/transactions-lucid.ts`
- Add PACT token validation before building claim transaction
- Reference PACT token in transaction (prove ownership)

**Deliverable:** Users must have PACT token to claim voting tokens

---

## File Structure

### New Files to Create

```
block-vote/
├── components/
│   └── ClaimPactDrawer.tsx          [Phase 1]
├── lib/
│   ├── query-drep.ts                [Phase 1]
│   ├── query-pact-token.ts          [Phase 1]
│   ├── transactions-pact.ts         [Phase 3]
│   └── plutus-data-pact.ts          [Phase 3]
└── docs/
    └── PACT_TOKEN_ACTION_PLAN.md    [This file]

block-vote-contracts/
└── validators/
    └── pact_membership.ak           [Phase 2]
```

### Files to Modify

```
block-vote/
├── components/
│   ├── Header.tsx                   [Phase 1 - Add CLAIM PACT button]
│   └── GovernanceActionDetail.tsx   [Phase 4 - Add token-gating]
└── lib/
    ├── contract-hashes.ts           [Phase 2 - Add PACT policy ID]
    └── transactions-lucid.ts        [Phase 4 - Add PACT validation]
```

---

## Data Flow

### 1. User Opens [CLAIM PACT] Drawer

```
User clicks [CLAIM PACT]
  ↓
ClaimPactDrawer opens
  ↓
Query wallet for stake address (Mesh)
  ↓
Query Blockfrost for DRep status
  ↓
Query Blockfrost for delegation amount
  ↓
Check wallet balance
  ↓
Validate thresholds
  ↓
Check if user has PACT token
  ↓
Display all info + enable/disable claim button
```

### 2. User Claims PACT Token

```
User clicks [CLAIM PACT TOKEN - 10 ADA]
  ↓
buildClaimPactTx()
  ↓
Generate unique token name (hash of address)
  ↓
Build datum (owner, timestamp, deposit, blacklisted=false)
  ↓
Create transaction:
  - Mint 1 PACT NFT
  - Send 10 ADA to PACT script with datum
  - Send PACT NFT to user
  ↓
User signs transaction
  ↓
Submit to blockchain
  ↓
Refresh drawer to show "✓ Claimed"
```

### 3. User Tries to Claim Voting Token

```
User clicks "Claim Voting Token" on governance action
  ↓
Check hasPactToken()
  ↓
If FALSE: Show error + redirect to [CLAIM PACT]
  ↓
If TRUE: Proceed with claim transaction
```

---

## Blockfrost API Reference

### Get Account Info (DRep Status + Delegation)

**Endpoint:**
```
GET https://cardano-preprod.blockfrost.io/api/v0/accounts/{stake_address}
```

**Headers:**
```
project_id: <BLOCKFROST_API_KEY>
```

**Response:**
```json
{
  "stake_address": "stake_test1uzpq2pepm6p0wl6v8ew4v7ksslcxwyu40v6e5yqvvq4g2gs68y60k",
  "active": true,
  "active_epoch": 123,
  "controlled_amount": "8500000000000",  // Delegation in lovelace
  "rewards_sum": "1234567",
  "withdrawals_sum": "0",
  "reserves_sum": "0",
  "treasury_sum": "0",
  "withdrawable_amount": "1234567",
  "pool_id": "pool1...",
  "drep_id": "drep1..." // NULL if not registered as DRep
}
```

**Key Fields:**
- `drep_id`: If not null, user is a registered DRep (Active status)
- `controlled_amount`: Total ADA delegated to this DRep (in lovelace)

### Threshold Calculation

```typescript
const DELEGATION_THRESHOLD = 13_000_000_000_000; // 13M ADA
const MIN_BALANCE = 10_000_000; // 10 ADA

const delegationAda = parseInt(accountInfo.controlled_amount);
const isDRep = accountInfo.drep_id !== null;
const passesThreshold = isDRep && delegationAda < DELEGATION_THRESHOLD;
```

---

## Smart Contract Logic

### ClaimPact Redeemer Flow

```
Transaction submits ClaimPact redeemer
  ↓
Validator checks:
  1. Minting exactly 1 token?
  2. Token name = blake2b_256(owner_address)?
  3. 10 ADA sent to script?
  4. Datum has correct owner?
  5. Datum has current timestamp?
  6. Datum has deposit = 10,000,000?
  7. Datum has blacklisted = False?
  8. Token minted to owner's address?
  ↓
All checks pass → Transaction succeeds
Any check fails → Transaction rejected
```

### Token Name Generation

**Purpose:** Ensure one PACT token per wallet

**Algorithm:**
```aiken
// In validator
token_name = blake2b_256(owner_address)
```

**Frontend equivalent:**
```typescript
import { blake2b } from 'blakejs';

function generatePactTokenName(address: string): string {
  const addressBytes = Buffer.from(address, 'hex');
  const hash = blake2b(addressBytes, null, 32);
  return Buffer.from(hash).toString('hex');
}
```

**Why this works:**
- Each address hashes to a unique token name
- User can only mint PACT with their own address as owner
- Attempting to mint a duplicate fails (token name already exists)

---

## Testing Plan

### Phase 1 Testing
- [ ] ClaimPactDrawer opens from header
- [ ] Displays wallet address correctly
- [ ] Displays stake address correctly
- [ ] Queries Blockfrost successfully
- [ ] Shows DRep status (Active/Inactive)
- [ ] Shows delegation amount in ADA
- [ ] Threshold validation displays correctly
- [ ] Claim button enables/disables based on eligibility

### Phase 2 Testing
- [ ] Contract compiles without errors
- [ ] Policy ID extracted correctly
- [ ] Deploy to preprod successful
- [ ] Test mint transaction on preprod
- [ ] Verify 10 ADA locked at script
- [ ] Verify datum structure correct
- [ ] Verify token name = hash(address)

### Phase 3 Testing
- [ ] buildClaimPactTx() creates valid transaction
- [ ] Transaction signs successfully
- [ ] Transaction submits to blockchain
- [ ] PACT token appears in wallet
- [ ] hasPactToken() returns true after claim
- [ ] Drawer shows "✓ Claimed" status
- [ ] Cannot claim second PACT token

### Phase 4 Testing
- [ ] User without PACT cannot claim voting token
- [ ] Error message displays correctly
- [ ] User with PACT can claim voting token
- [ ] Voting token claim references PACT correctly

---

## Post-MVP Features (Deferred)

### Redeem PACT Token (9 ADA Return)

**Validator Updates:**
- Add RedeemDeposit redeemer logic
- Check blacklisted = False
- Check owner signature
- Burn PACT token
- Return 9 ADA to owner
- 1 ADA stays in script (fee/treasury)

**Frontend Updates:**
- Add "Redeem PACT" button to drawer
- Build redeem transaction
- Handle success/failure

### Blacklist Functionality

**Validator Updates:**
- Add Blacklist redeemer logic
- Require admin signature
- Update datum: blacklisted = True
- Prevent redemption if blacklisted
- Force burn (no refund) if blacklisted user tries to redeem

**Frontend Updates:**
- Admin interface for blacklisting
- Show blacklist status in drawer
- Prevent redeem button if blacklisted

### Admin Dashboard
- List all PACT token holders
- Blacklist/unblacklist users
- View treasury balance
- Analytics (total claims, redemptions, etc.)

---

## Constants Reference

```typescript
// Thresholds
export const DELEGATION_THRESHOLD = 13_000_000_000_000; // 13M ADA in lovelace
export const MIN_WALLET_BALANCE = 10_000_000;          // 10 ADA in lovelace

// PACT Token
export const PACT_CLAIM_COST = 10_000_000;             // 10 ADA in lovelace
export const PACT_REDEEM_AMOUNT = 9_000_000;           // 9 ADA in lovelace
export const PACT_FEE = 1_000_000;                     // 1 ADA in lovelace

// Contract (to be filled after Phase 2)
export const PACT_POLICY_ID = ""; // From compiled contract
export const PACT_SCRIPT_HASH = ""; // From compiled contract
```

---

## Risk Mitigation

### Risk: Blockfrost API Downtime
**Mitigation:**
- Add error handling with user-friendly messages
- Implement retry logic (3 attempts with exponential backoff)
- Consider caching DRep data (with expiration)

### Risk: User Manipulates Delegation to Bypass Threshold
**Mitigation:**
- On-chain validation is not possible (delegation is off-chain state)
- Frontend validation is for UX only
- PACT token itself doesn't validate delegation
- Consider periodic re-validation of PACT holders

### Risk: User Claims PACT, Then Increases Delegation Above Threshold
**Mitigation:**
- PACT token remains valid (no automatic revocation)
- Post-MVP: Implement periodic audits and blacklisting
- Post-MVP: Require PACT refresh/renewal with re-validation

### Risk: Unique Token Name Collision
**Mitigation:**
- blake2b_256 has negligible collision probability
- One address = one hash = one token name
- Validator enforces: owner in datum must match address that hashes to token name

---

## Success Metrics

### Phase 1 Success
- ClaimPactDrawer displays all required information
- Blockfrost integration works without errors
- Threshold validation accurately reflects eligibility

### Phase 2 Success
- Contract deploys to preprod
- Test mint transaction succeeds
- 10 ADA locked correctly
- Token appears in user wallet

### Phase 3 Success
- Users can claim PACT tokens through UI
- Transaction flow is smooth (sign → submit → confirm)
- Error handling works for edge cases

### Phase 4 Success
- Users without PACT cannot claim voting tokens
- Users with PACT can proceed to claim voting tokens
- Token-gating is enforced consistently

---

## Timeline Estimate

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| Phase 1 | DRep Queries + UI | 2-3 days |
| Phase 2 | Smart Contract | 2-3 days |
| Phase 3 | Transaction Building | 2-3 days |
| Phase 4 | Token-Gate Integration | 1-2 days |
| **Total** | **MVP Complete** | **7-11 days** |

---

## Next Steps

Based on user preference for **Option A (UI) + Option C (DRep Queries)**:

### Immediate Tasks:
1. Create `/lib/query-drep.ts` with Blockfrost integration
2. Create `/components/ClaimPactDrawer.tsx` with mock data
3. Update `/components/Header.tsx` to add [CLAIM PACT] button
4. Test DRep queries with real Blockfrost data
5. Wire up drawer to display real DRep status

**Ready to start implementation?**

---

## Questions & Notes

### Open Questions:
- [ ] Should we display DRep voting power history?
- [ ] Should we cache Blockfrost responses (how long)?
- [ ] Do we want analytics on PACT token claims?

### Design Decisions:
- ✅ Use Blockfrost for DRep data (not Gov.tools)
- ✅ One NFT per wallet (unique asset name)
- ✅ Start with UI + DRep queries (Phase 1 + 3 parallel)
- ✅ Defer redemption and blacklisting to post-MVP

---

**Document Status:** Complete - Ready for Implementation
**Last Updated:** 2024-12-09
**Next Review:** After Phase 1 completion
