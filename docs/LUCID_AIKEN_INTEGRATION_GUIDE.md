# Lucid Evolution + Aiken Integration Guide

A comprehensive guide for building Cardano dApps with Lucid Evolution and Aiken smart contracts, based on real-world implementation experience.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Parameterized Scripts](#parameterized-scripts)
4. [Plutus Data Serialization](#plutus-data-serialization)
5. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
6. [Transaction Building Patterns](#transaction-building-patterns)
7. [Debugging Guide](#debugging-guide)
8. [Best Practices](#best-practices)

---

## Overview

### Technology Stack

- **Lucid Evolution** (v0.4.29+): TypeScript library for Cardano transaction building
- **Aiken**: Smart contract language (compiles to Plutus V3)
- **Mesh SDK**: Wallet connection and transaction signing (can be used alongside Lucid)

### Key Integration Points

1. **Smart Contract Compilation**: Aiken → `plutus.json` blueprint
2. **Parameter Application**: Apply runtime parameters to validators
3. **Data Serialization**: TypeScript → Plutus Data (CBOR)
4. **Transaction Building**: Lucid Evolution transaction builder
5. **Wallet Integration**: Mesh SDK for signing/submission

---

## Core Concepts

### 1. Plutus Data vs. TypeScript Types

Aiken smart contracts use **Plutus Data** (CBOR-encoded), not JSON or plain TypeScript objects.

**TypeScript Type:**
```typescript
type Credential = {
  type: 'VerificationKey' | 'Script';
  hash: string;
}
```

**Plutus Data (Aiken):**
```aiken
pub type Credential {
  VerificationKey(ByteArray)  // Constructor 0
  Script(ByteArray)            // Constructor 1
}
```

**Serialization (Lucid Evolution):**
```typescript
import { Data, Constr } from '@lucid-evolution/lucid';

// ✅ Correct - Using Constr class
function credentialToData(credential: Credential): Data {
  if (credential.type === 'VerificationKey') {
    return new Constr(0, [credential.hash]);
  } else {
    return new Constr(1, [credential.hash]);
  }
}

// ❌ Wrong - Plain objects don't work
const wrongData = { constructor: 0, fields: [credential.hash] };
```

### 2. CBOR Encoding Levels

Scripts in `plutus.json` can have different CBOR encoding levels:
- **Single**: Encoded once
- **Double**: Encoded twice (wraps single-encoded script)

```typescript
import { CBOREncodingLevel, applyDoubleCborEncoding } from '@lucid-evolution/utils';

const script = validator.compiledCode;
const level = CBOREncodingLevel(script); // "single" or "double"

// Only apply if needed
if (level === 'single' && needsDoubleEncoding) {
  const doubleEncoded = applyDoubleCborEncoding(script);
}
```

**Rule of Thumb:** Scripts from `plutus.json` are usually already at the correct encoding level. Don't add extra encoding unless specifically required by the function you're calling.

---

## Parameterized Scripts

### Understanding Parameterization

Aiken validators can be **parameterized** - they accept compile-time parameters that customize their behavior.

**Example: One-time Minting Policy**
```aiken
// Validator is parameterized by a UTxO reference
validator minting_policy(utxo_ref: OutputReference) {
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    // Validate that utxo_ref is consumed (ensures one-time mint)
    validate_utxo_consumed(tx.inputs, utxo_ref)
  }
}
```

### Why Parameterization Matters

The script hash (policy ID) **changes** when parameters are applied:

```typescript
// ❌ WRONG: Using unparameterized hash
const POLICY_ID = "b11bc31c...";  // Hash from plutus.json

// ✅ CORRECT: Hash of parameterized script
const parameterizedScript = applyParamsToScript(baseScript, [utxoRefData]);
const POLICY_ID = calculateScriptHash(parameterizedScript);
```

### Step-by-Step: Applying Parameters

```typescript
import { Data, Constr } from '@lucid-evolution/lucid';
import { applyParamsToScript } from '@lucid-evolution/utils';
import { PlutusV3Script } from '@anastasia-labs/cardano-multiplatform-lib-browser';

// 1. Get the base (unparameterized) script from plutus.json
const baseMintingPolicy = getMintingPolicyValidator();
const baseScript = baseMintingPolicy.compiledCode;

// 2. Convert your parameter to Plutus Data
// For OutputReference: Constr(0, [transaction_id: ByteArray, output_index: Int])
const utxoRefData = new Constr(0, [
  utxoRef.txHash,                    // ByteArray (hex string)
  BigInt(utxoRef.outputIndex)        // Int (BigInt)
]);

// 3. Apply the parameter
const parameterizedScript = applyParamsToScript(baseScript, [utxoRefData]);

// 4. Calculate the actual policy ID (hash of parameterized script)
const scriptBytes = PlutusV3Script.from_cbor_hex(parameterizedScript);
const actualPolicyId = scriptBytes.hash().to_hex();

// 5. Use the parameterized script in transactions
const mintingScript = {
  type: 'PlutusV3' as const,
  script: parameterizedScript,  // ✅ Use parameterized, not base
};
```

### Critical Rules for Parameterized Scripts

1. **Always use the parameterized script** in transactions, not the base script
2. **Always use the parameterized policy ID** in datums and token asset IDs
3. **Include parameter values in transaction** if validator checks them (e.g., consume the UTxO)
4. **Match datum fields** - if validator checks `datum.policy_id == policy_id`, ensure they match

---

## Plutus Data Serialization

### Common Aiken Types → Plutus Data

#### 1. OutputReference

**Aiken Schema:**
```aiken
pub type OutputReference {
  transaction_id: ByteArray,
  output_index: Int,
}
```

**Serialization:**
```typescript
// ✅ CORRECT
const utxoRefData = new Constr(0, [
  txHash,              // ByteArray (hex string, NOT wrapped in Constr)
  BigInt(outputIndex)  // Int
]);

// ❌ WRONG - Extra Constr wrapper
const wrongData = new Constr(0, [
  new Constr(0, [txHash]),  // ❌ Don't wrap ByteArray
  BigInt(outputIndex)
]);
```

#### 2. Credential

**Aiken Schema:**
```aiken
pub type Credential {
  VerificationKey(ByteArray)  // Constructor 0
  Script(ByteArray)            // Constructor 1
}
```

**Serialization:**
```typescript
function credentialToData(credential: Credential): Data {
  if (credential.type === 'VerificationKey') {
    return new Constr(0, [credential.hash]);
  } else {
    return new Constr(1, [credential.hash]);
  }
}
```

#### 3. Address

**Aiken Schema:**
```aiken
pub type Address {
  payment_credential: Credential,
  stake_credential: Option<StakeCredential>,
}
```

**Serialization:**
```typescript
function scriptHashToAddressData(scriptHash: string): Data {
  return new Constr(0, [
    // payment_credential: Script type (constructor 1)
    new Constr(1, [scriptHash]),
    // stake_credential: None (constructor 1)
    new Constr(1, [])
  ]);
}
```

#### 4. Custom Datum with Multiple Fields

**Aiken Schema:**
```aiken
pub type GovernancePactDatum {
  title: ByteArray,
  description: ByteArray,
  voting_deadline: Int,
  total_members: Int,
  policy_id: PolicyId,  // PolicyId is ByteArray
  metadata_validator: Address,
}
```

**Serialization:**
```typescript
import { Constr } from '@lucid-evolution/lucid';

function stringToHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex');
}

function governancePactDatumToData(datum: GovernancePactDatum): Data {
  return new Constr(0, [
    stringToHex(datum.title),           // ByteArray
    stringToHex(datum.description),     // ByteArray
    BigInt(datum.votingDeadline),       // Int
    BigInt(datum.totalMembers),         // Int
    datum.policyId,                     // ByteArray (already hex)
    scriptHashToAddressData(datum.metadataValidator), // Address
  ]);
}
```

### Data Type Mapping Reference

| Aiken Type | TypeScript | Plutus Data (Constr) |
|------------|------------|----------------------|
| `ByteArray` | `string` (hex) | `"deadbeef"` (plain string) |
| `Int` | `number` / `bigint` | `BigInt(42)` |
| `Bool` | `boolean` | `new Constr(0, [])` (True) or `new Constr(1, [])` (False) |
| `List<T>` | `Array<T>` | `[item1, item2, ...]` (array of serialized items) |
| `Option<T>` | `T \| null` | `new Constr(0, [value])` (Some) or `new Constr(1, [])` (None) |
| `CustomType` | `interface` | `new Constr(index, [field1, field2, ...])` |

### Serialization Example: Complete Redeemer

**Aiken Schema:**
```aiken
pub type MintRedeemer {
  CreatePact {
    qualified_members: List<Credential>,
    pact_datum: GovernancePactDatum,
  }
}
```

**TypeScript Interface:**
```typescript
type MintRedeemer = {
  type: 'CreatePact';
  qualifiedMembers: Credential[];
  pactDatum: GovernancePactDatum;
}
```

**Serialization Function:**
```typescript
function mintRedeemerToData(
  redeemer: MintRedeemer,
  metadataScriptHash: string,
  distributionScriptHash: string
): Data {
  // Convert list of credentials
  const credentialsList = redeemer.qualifiedMembers.map(
    cred => credentialToData(cred)
  );

  // Convert pact datum
  const pactDatumData = governancePactDatumToData(
    redeemer.pactDatum,
    metadataScriptHash,
    distributionScriptHash
  );

  // CreatePact is constructor 0
  return new Constr(0, [
    credentialsList,  // List<Credential>
    pactDatumData     // GovernancePactDatum
  ]);
}

// Use it
const redeemerData = mintRedeemerToData(redeemer, scriptHash1, scriptHash2);
const redeemerCbor = Data.to(redeemerData);
```

---

## Common Pitfalls & Solutions

### 1. Script Validator Crashes ("validator crashed / exited prematurely")

**Symptom:**
```
TxBuilderError: failed script execution Mint[0] the validator crashed / exited prematurely
```

**Common Causes:**
- ❌ Wrong Plutus Data structure (extra/missing Constr wrappers)
- ❌ Wrong constructor index
- ❌ ByteArray wrapped in Constr when it should be a plain string
- ❌ Using unparameterized script instead of parameterized

**Solution:**
1. Check `plutus.json` schema for exact data structure
2. Verify constructor indices match Aiken definition order
3. Ensure ByteArray fields are plain hex strings, not Constr objects
4. Log serialized CBOR to verify structure: `console.log(Data.to(myData))`

### 2. InvalidReturnValue (Script Returns False)

**Symptom:**
```
The plutus evaluation error is: InvalidReturnValue
```

**Common Causes:**
- ❌ Policy ID mismatch (using unparameterized hash in datum)
- ❌ Datum fields don't match redeemer fields
- ❌ Validator addresses don't match
- ❌ Required UTxO not included in transaction inputs
- ❌ Token quantities don't match expected values

**Solution:**
1. Ensure parameterized policy ID is used everywhere
2. Verify datum and redeemer contain matching data
3. Include all UTxOs that the validator checks for
4. Double-check token asset IDs (policy ID + asset name)

### 3. Metadata Validation Errors

**Symptom (Lucid Evolution):**
```
Expected a string at most 64 character(s) long
```

**Cause:** Lucid Evolution enforces strict 64-character limit on ALL metadata string values.

**Solution:**
```typescript
// Truncate long fields
const truncatedTitle = title.length > 64
  ? title.substring(0, 61) + '...'
  : title;

// Remove embedded images (Base64 data URIs exceed 64 chars)
const metadata = {
  '721': {
    [policyId]: {
      [assetName]: {
        name: truncatedTitle,
        description: truncatedDescription,
        // ❌ image: 'data:image/svg+xml;base64,...' // Too long!
        // Add IPFS URL instead if needed
        cardano_action_id: truncatedActionId,
      }
    }
  }
};
```

### 4. Wrong Script Encoding

**Symptom:** Script fails to parse or execute

**Solution:**
```typescript
// Check encoding level first
const level = CBOREncodingLevel(script);
console.log('Script encoding:', level);

// Don't double-encode scripts from plutus.json
// They're usually already at the correct level
const parameterizedScript = applyParamsToScript(
  baseScript,  // ✅ Use as-is from plutus.json
  [params]
);
```

### 5. Validator Address Derivation

**Symptom:** Tokens sent to wrong address, or validator can't find UTxOs

**Solution:**
```typescript
import { credentialToAddress, scriptHashToCredential } from '@lucid-evolution/utils';

// ✅ CORRECT - Use Lucid's address derivation
function getValidatorAddress(lucid: LucidEvolution, scriptHash: string): string {
  const network = lucid.config().network;
  const credential = scriptHashToCredential(scriptHash);
  const address = credentialToAddress(network, credential);
  return address;
}

// ❌ WRONG - Don't use validatorToAddress with script hash
// (validatorToAddress expects full script object, not hash)
```

---

## Transaction Building Patterns

### Pattern 1: Minting with Parameterized Policy

```typescript
import { LucidEvolution } from '@lucid-evolution/lucid';
import { Data, Constr } from '@lucid-evolution/lucid';
import { applyParamsToScript } from '@lucid-evolution/utils';

async function mintTokensWithParameterizedPolicy(
  lucid: LucidEvolution,
  baseMintingPolicy: { compiledCode: string; hash: string },
  utxoRef: { txHash: string; outputIndex: number },
  assetName: string,
  quantity: bigint,
  redeemer: Data
) {
  // 1. Apply UTxO parameter
  const utxoRefData = new Constr(0, [
    utxoRef.txHash,
    BigInt(utxoRef.outputIndex)
  ]);

  const parameterizedScript = applyParamsToScript(
    baseMintingPolicy.compiledCode,
    [utxoRefData]
  );

  // 2. Calculate actual policy ID
  const { PlutusV3Script } = await import('@anastasia-labs/cardano-multiplatform-lib-browser');
  const scriptBytes = PlutusV3Script.from_cbor_hex(parameterizedScript);
  const policyId = scriptBytes.hash().to_hex();

  // 3. Get the UTxO to consume
  const walletUtxos = await lucid.wallet().getUtxos();
  const utxoToConsume = walletUtxos.find(
    u => u.txHash === utxoRef.txHash && u.outputIndex === utxoRef.outputIndex
  );

  if (!utxoToConsume) {
    throw new Error('UTxO not found');
  }

  // 4. Build asset ID
  const assetId = policyId + assetName;

  // 5. Build transaction
  const tx = await lucid
    .newTx()
    .collectFrom([utxoToConsume])  // Consume the parameter UTxO
    .mintAssets({ [assetId]: quantity }, redeemer)
    .attach.MintingPolicy({
      type: 'PlutusV3',
      script: parameterizedScript,
    })
    .complete();

  return { tx, policyId, assetId };
}
```

### Pattern 2: Sending Assets to Script with Inline Datum

```typescript
async function sendToScriptWithDatum(
  lucid: LucidEvolution,
  scriptHash: string,
  datum: Data,
  assets: { lovelace: bigint; [assetId: string]: bigint }
) {
  // 1. Get validator address
  const network = lucid.config().network;
  const credential = scriptHashToCredential(scriptHash);
  const validatorAddress = credentialToAddress(network, credential);

  // 2. Serialize datum to CBOR
  const datumCbor = Data.to(datum);

  // 3. Build transaction
  const tx = await lucid
    .newTx()
    .pay.ToAddressWithData(
      validatorAddress,
      { kind: 'inline', value: datumCbor },
      assets
    )
    .complete();

  return tx;
}
```

### Pattern 3: Complete CREATE PACT Transaction

```typescript
async function buildCreatePactTransaction(
  lucid: LucidEvolution,
  params: {
    baseMintingPolicy: { compiledCode: string };
    utxoRef: { txHash: string; outputIndex: number };
    qualifiedMembers: Credential[];
    pactDatum: GovernancePactDatum;
    assetName: string;
    metadataValidatorHash: string;
    distributionValidatorHash: string;
  }
) {
  const { Data, Constr } = await import('@lucid-evolution/lucid');
  const { applyParamsToScript } = await import('@lucid-evolution/utils');

  // 1. Apply UTxO parameter to minting policy
  const utxoRefData = new Constr(0, [
    params.utxoRef.txHash,
    BigInt(params.utxoRef.outputIndex)
  ]);

  const parameterizedScript = applyParamsToScript(
    params.baseMintingPolicy.compiledCode,
    [utxoRefData]
  );

  const { PlutusV3Script } = await import('@anastasia-labs/cardano-multiplatform-lib-browser');
  const policyId = PlutusV3Script.from_cbor_hex(parameterizedScript)
    .hash()
    .to_hex();

  // 2. Create token names (CIP-068)
  const refTokenName = '000643b0' + stringToHex(params.assetName);
  const userTokenName = '001bc280' + stringToHex(params.assetName);
  const refAssetId = policyId + refTokenName;
  const userAssetId = policyId + userTokenName;

  // 3. Update pact datum with actual policy ID
  const correctedPactDatum = {
    ...params.pactDatum,
    policyId: policyId,  // ✅ Use parameterized policy ID
  };

  // 4. Build redeemer
  const mintRedeemer = new Constr(0, [
    params.qualifiedMembers.map(cred => credentialToData(cred)),
    governancePactDatumToData(
      correctedPactDatum,
      params.metadataValidatorHash,
      params.distributionValidatorHash
    )
  ]);
  const redeemerCbor = Data.to(mintRedeemer);

  // 5. Build datums
  const governanceDatum = Data.to(governancePactDatumToData(
    correctedPactDatum,
    params.metadataValidatorHash,
    params.distributionValidatorHash
  ));

  const distributionDatum = Data.to(new Constr(0, [
    params.qualifiedMembers.map(cred => credentialToData(cred)),
    policyId,
    userTokenName,
    BigInt(params.qualifiedMembers.length)
  ]));

  // 6. Get addresses
  const metadataAddress = getValidatorAddress(lucid, params.metadataValidatorHash);
  const distributionAddress = getValidatorAddress(lucid, params.distributionValidatorHash);

  // 7. Get UTxO to consume
  const walletUtxos = await lucid.wallet().getUtxos();
  const utxoToConsume = walletUtxos.find(
    u => u.txHash === params.utxoRef.txHash &&
         u.outputIndex === params.utxoRef.outputIndex
  );

  if (!utxoToConsume) {
    throw new Error('UTxO not found');
  }

  // 8. Build transaction
  const minAda = 3_000_000n;

  const tx = await lucid
    .newTx()
    .collectFrom([utxoToConsume])
    .mintAssets({ [refAssetId]: 1n }, redeemerCbor)
    .mintAssets({ [userAssetId]: BigInt(params.qualifiedMembers.length) }, redeemerCbor)
    .attach.MintingPolicy({
      type: 'PlutusV3',
      script: parameterizedScript,
    })
    .pay.ToAddressWithData(
      metadataAddress,
      { kind: 'inline', value: governanceDatum },
      { lovelace: minAda, [refAssetId]: 1n }
    )
    .pay.ToAddressWithData(
      distributionAddress,
      { kind: 'inline', value: distributionDatum },
      { lovelace: minAda, [userAssetId]: BigInt(params.qualifiedMembers.length) }
    )
    .attachMetadata(721, buildCIP25Metadata(policyId, userTokenName, metadata))
    .complete();

  return tx;
}
```

---

## Debugging Guide

### Step 1: Enable Verbose Logging

```typescript
async function buildTransactionWithLogging() {
  console.log('Step 1: Applying parameters...');
  const parameterizedScript = applyParamsToScript(baseScript, [param]);
  console.log('Parameterized script (first 100 chars):', parameterizedScript.substring(0, 100));

  console.log('Step 2: Calculating policy ID...');
  const policyId = calculateHash(parameterizedScript);
  console.log('Policy ID:', policyId);

  console.log('Step 3: Building redeemer...');
  const redeemer = buildRedeemer();
  console.log('Redeemer CBOR:', Data.to(redeemer));

  console.log('Step 4: Building transaction...');
  const tx = lucid.newTx();

  console.log('Step 5: Collecting UTxOs...');
  tx.collectFrom([utxo]);

  console.log('Step 6: Minting assets...');
  tx.mintAssets({ [assetId]: 1n }, redeemer);

  console.log('Step 7: Completing transaction...');
  const completedTx = await tx.complete();

  console.log('✅ Transaction built successfully');
  return completedTx;
}
```

### Step 2: Verify CBOR Serialization

Use an online CBOR decoder to inspect serialized data:
- https://cbor.me/

```typescript
const datum = new Constr(0, [
  "deadbeef",
  42n,
  new Constr(1, [])
]);

const cborHex = Data.to(datum);
console.log('CBOR:', cborHex);
// Copy and paste into cbor.me to verify structure
```

### Step 3: Compare with Working Examples

If you have a working Mesh SDK implementation:

```typescript
// Mesh implementation (working)
const meshRedeemer = {
  data: { alternative: 0, fields: [...] }
};

// Lucid implementation (testing)
const lucidRedeemer = new Constr(0, [...]);

// Compare serialized output
console.log('Mesh CBOR:', meshRedeemerCbor);
console.log('Lucid CBOR:', Data.to(lucidRedeemer));
// Should match exactly
```

### Step 4: Isolate the Failing Component

```typescript
try {
  // Test 1: Simple serialization
  const simple = Data.to(new Constr(0, []));
  console.log('✅ Simple Constr works');

  // Test 2: With BigInt
  const withBigInt = Data.to(new Constr(0, [42n]));
  console.log('✅ BigInt works');

  // Test 3: With hex string
  const withHex = Data.to(new Constr(0, ["deadbeef"]));
  console.log('✅ Hex string works');

  // Test 4: Nested
  const nested = Data.to(new Constr(0, [new Constr(1, ["cafe"])]));
  console.log('✅ Nested works');

  // Test 5: Your actual data
  const actual = Data.to(yourComplexDatum);
  console.log('✅ Complex datum works');
} catch (err) {
  console.error('❌ Failed at:', err);
}
```

### Step 5: Validate Against plutus.json Schema

```bash
# Extract schema from plutus.json
cat plutus.json | jq '.definitions["your_module/YourType"]'
```

Compare TypeScript serialization with expected schema:

**Schema:**
```json
{
  "dataType": "constructor",
  "index": 0,
  "fields": [
    { "title": "field1", "$ref": "#/definitions/ByteArray" },
    { "title": "field2", "$ref": "#/definitions/Int" }
  ]
}
```

**Serialization:**
```typescript
// ✅ Matches schema
new Constr(0, [
  "hexstring",  // ByteArray
  42n           // Int
])
```

### Common Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `validator crashed / exited prematurely` | Wrong Plutus Data structure | Check schema, verify Constr indices |
| `InvalidReturnValue` | Validator logic returned False | Check datum/redeemer match, policy ID, UTxO consumption |
| `Expected a string at most 64 character(s)` | Metadata field too long | Truncate strings, remove images |
| `TxBuilderError: Complete` | Transaction building failed | Check step-by-step logs, verify addresses |
| `Failed to parse script` | Wrong CBOR encoding | Use script as-is from plutus.json |

---

## Best Practices

### 1. Project Structure

```
project/
├── contracts/               # Aiken smart contracts
│   ├── validators/
│   │   ├── minting_policy.ak
│   │   └── spending_validator.ak
│   ├── aiken.toml
│   └── plutus.json         # Generated by Aiken
│
├── lib/
│   ├── contracts.ts        # Load plutus.json, export validators
│   ├── plutus-data.ts      # Plutus Data serialization functions
│   ├── transactions-lucid.ts # Lucid transaction builders
│   └── lucid-provider.ts   # Lucid initialization
│
└── types/
    └── contracts.ts        # TypeScript interfaces matching Aiken types
```

### 2. Type Safety

**Define TypeScript types that mirror Aiken schemas:**

```typescript
// types/contracts.ts
export type Credential =
  | { type: 'VerificationKey'; hash: string }
  | { type: 'Script'; hash: string };

export type GovernancePactDatum = {
  title: string;
  description: string;
  votingDeadline: number;
  totalMembers: number;
  policyId: string;
  metadataValidator: string;
  distributionValidator: string;
};

export type MintRedeemer = {
  type: 'CreatePact';
  qualifiedMembers: Credential[];
  pactDatum: GovernancePactDatum;
};
```

**Create a dedicated serialization module:**

```typescript
// lib/plutus-data.ts
import type { Credential, GovernancePactDatum, MintRedeemer } from '@/types/contracts';
import type { Data, Constr } from '@lucid-evolution/lucid';

export function credentialToData(credential: Credential, Constr: any): Data {
  // ... serialization logic
}

export function governancePactDatumToData(
  datum: GovernancePactDatum,
  metadataScriptHash: string,
  distributionScriptHash: string,
  Constr: any
): Data {
  // ... serialization logic
}
```

### 3. Contract Loading

**Centralize plutus.json loading:**

```typescript
// lib/contracts.ts
import plutusBlueprint from './plutus.json';

export function getMintingPolicyValidator() {
  const validator = plutusBlueprint.validators.find(
    v => v.title === 'minting_policy.minting_policy.mint'
  );

  if (!validator) {
    throw new Error('Minting policy not found in plutus.json');
  }

  return validator;
}

export const MINTING_POLICY_HASH = getMintingPolicyValidator().hash;
export const METADATA_VALIDATOR_HASH = getMetadataValidator().hash;
```

### 4. Error Handling

**Wrap transaction building in detailed error handlers:**

```typescript
async function buildTransaction() {
  try {
    console.log('Building transaction...');

    const tx = await lucid.newTx()
      .mintAssets(...)
      .complete();

    console.log('✅ Transaction built');
    return { success: true, tx };

  } catch (error) {
    console.error('❌ Transaction failed');
    console.error('Error:', error);

    if (error && typeof error === 'object') {
      const err = error as any;
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error cause:', err.cause);
      console.error('Error stack:', err.stack);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

### 5. Testing Strategy

**Test serialization independently:**

```typescript
// tests/plutus-data.test.ts
import { describe, it, expect } from 'vitest';
import { credentialToData } from '@/lib/plutus-data';
import { Data, Constr } from '@lucid-evolution/lucid';

describe('Plutus Data Serialization', () => {
  it('serializes VerificationKey credential correctly', () => {
    const credential = {
      type: 'VerificationKey',
      hash: 'abcdef123456'
    };

    const result = credentialToData(credential, Constr);
    const cbor = Data.to(result);

    // Verify structure
    expect(result).toBeInstanceOf(Constr);
    expect(result.index).toBe(0);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toBe('abcdef123456');
  });
});
```

**Test transaction building on testnet:**

1. Use preprod testnet for all development
2. Get test ADA from faucet: https://docs.cardano.org/cardano-testnets/tools/faucet/
3. Test each transaction type individually
4. Verify on block explorer: https://preprod.cardanoscan.io/

### 6. Documentation

**Document each validator's requirements:**

```typescript
/**
 * Build CREATE PACT transaction
 *
 * Mints CIP-068 dual tokens:
 * - 1 Reference Token (label 100) → Metadata Validator
 * - N User Tokens (label 222) → Distribution Validator
 *
 * Validator Requirements:
 * - Must consume the UTxO specified in minting policy parameter
 * - Policy ID in datum must match parameterized policy ID
 * - Token quantities: exactly 1 ref token, exactly N user tokens
 * - Outputs must include inline datums
 *
 * @param lucid - Lucid Evolution instance
 * @param params - Transaction parameters
 * @returns Completed transaction
 */
export async function buildCreatePactTx(
  lucid: LucidEvolution,
  params: CreatePactParams
): Promise<Transaction> {
  // ...
}
```

### 7. Code Reusability

**Create reusable helper functions:**

```typescript
// lib/helpers.ts

/**
 * Convert string to hex (UTF-8)
 */
export function stringToHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex');
}

/**
 * Get validator address from script hash
 */
export function getValidatorAddress(
  lucid: LucidEvolution,
  scriptHash: string
): string {
  const network = lucid.config().network;
  const credential = scriptHashToCredential(scriptHash);
  return credentialToAddress(network, credential);
}

/**
 * Calculate required votes (simple majority)
 */
export function calculateRequiredVotes(totalMembers: number): number {
  return Math.floor(totalMembers / 2) + 1;
}
```

### 8. Lucid Initialization

**Centralize Lucid setup:**

```typescript
// lib/lucid-provider.ts
import { Lucid, Blockfrost } from '@lucid-evolution/lucid';

export async function initializeLucid(): Promise<LucidEvolution> {
  const lucid = await Lucid(
    new Blockfrost(
      'https://cardano-preprod.blockfrost.io/api/v0',
      process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY!
    ),
    'Preprod'
  );

  return lucid;
}

export async function connectMeshWalletToLucid(
  lucid: LucidEvolution,
  meshWallet: IWallet
): Promise<void> {
  const address = await meshWallet.getChangeAddress();
  lucid.selectWallet.fromAddress(address, []);
}
```

---

## Quick Reference Checklist

Before submitting a transaction, verify:

- [ ] Parameterized scripts use the **parameterized policy ID**, not base hash
- [ ] All datum fields match what the validator expects
- [ ] ByteArray fields are **plain hex strings**, not wrapped in Constr
- [ ] Constructor indices match Aiken schema order (0-indexed)
- [ ] Required UTxOs are included in transaction inputs
- [ ] Validator addresses are derived correctly
- [ ] Token asset IDs = `policyId + assetName` (both hex)
- [ ] Inline datums are serialized with `Data.to()`
- [ ] Metadata strings are ≤64 characters (Lucid Evolution)
- [ ] Script encoding level is correct (usually "single")
- [ ] Error logging is enabled for debugging
- [ ] Testing on preprod testnet before mainnet

---

## Additional Resources

### Official Documentation
- **Lucid Evolution**: https://github.com/Anastasia-Labs/lucid-evolution
- **Aiken Language**: https://aiken-lang.org/
- **Cardano Documentation**: https://docs.cardano.org/
- **CIP-68 (Asset Name Labels)**: https://cips.cardano.org/cip/CIP-68

### Tools
- **CBOR Decoder**: https://cbor.me/
- **Cardano Testnet Faucet**: https://docs.cardano.org/cardano-testnets/tools/faucet/
- **Preprod Explorer**: https://preprod.cardanoscan.io/
- **Blockfrost API**: https://blockfrost.io/

### Community
- **Aiken Discord**: https://discord.gg/aiken
- **Cardano Stack Exchange**: https://cardano.stackexchange.com/
- **IOG Technical Community**: https://discord.gg/inputoutput

---

## Changelog

- **2024-12-08**: Initial version based on blockVote CREATE PACT implementation
  - Added parameterized script patterns
  - Added Plutus Data serialization guide
  - Added debugging strategies
  - Added common pitfalls and solutions

---

*This guide is based on real-world implementation of the blockVote governance dApp using Lucid Evolution v0.4.29 and Aiken smart contracts on Cardano preprod testnet.*
