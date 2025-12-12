/**
 * BlockVote Transaction Builders (Lucid Evolution)
 *
 * Lucid Evolution transaction builders for smart contract interactions
 */

import type { LucidEvolution } from '@lucid-evolution/lucid';
import type { IWallet } from '@meshsdk/core';
import type {
  CreatePactParams,
  GovernancePactDatum,
  DistributionDatum,
  TxBuildResult,
  MintRedeemer,
} from '../types/contracts';
import {
  getMintingPolicyValidator,
  MINTING_POLICY_HASH,
  METADATA_VALIDATOR_SCRIPT,
  METADATA_VALIDATOR_HASH,
  DISTRIBUTION_VALIDATOR_SCRIPT,
  DISTRIBUTION_VALIDATOR_HASH,
  makeReferenceTokenName,
  makeUserTokenName,
} from './contracts';
import { buildTokenMetadata } from './metadata';
import { initializeLucid, connectMeshWalletToLucid, getValidatorAddress } from './lucid-provider';
import {
  mintRedeemerToData,
  governancePactDatumToData,
  distributionDatumToData,
} from './plutus-data-lucid';

// ============================================================================
// CREATE PACT Transaction (Lucid Evolution)
// ============================================================================

/**
 * Build and submit a CREATE PACT transaction using Lucid Evolution
 *
 * This mints CIP-068 dual tokens:
 * - 1 Reference Token → Metadata Validator
 * - N User Tokens → Distribution Validator
 *
 * @param meshWallet - Connected Mesh wallet (used for signing)
 * @param params - Create pact parameters
 * @returns Transaction result
 */
export async function buildCreatePactTx_Lucid(
  meshWallet: IWallet,
  params: CreatePactParams
): Promise<TxBuildResult> {
  try {
    console.log('\n🚀 Building CREATE PACT transaction with Lucid Evolution...');

    // 1. Initialize Lucid and import Data utility + Constr class
    const lucid = await initializeLucid();
    await connectMeshWalletToLucid(lucid, meshWallet);

    // Import Data, Constr, and applyParamsToScript from Lucid modules
    const { Data, Constr } = await import('@lucid-evolution/lucid');
    const { applyParamsToScript, CBOREncodingLevel } = await import('@lucid-evolution/utils');
    console.log('✅ Lucid initialized and connected to wallet');

    // 2. Apply UTxO parameter to minting policy to get the actual policy ID
    // The minting policy is parameterized by a UTxO reference
    console.log('Applying UTxO parameter to minting policy...');
    console.log('UTxO ref:', params.utxoRef);

    // Convert UTxO reference to Plutus Data format
    // OutputReference: constructor 0 with fields [transaction_id: ByteArray, output_index: Int]
    const utxoRefData = new Constr(0, [
      params.utxoRef.txHash, // ByteArray (hex string)
      BigInt(params.utxoRef.outputIndex) // Int
    ]);
    const utxoRefCbor = Data.to(utxoRefData);
    console.log('UTxO ref CBOR:', utxoRefCbor);

    // Get the base minting policy script
    const baseMintingPolicy = getMintingPolicyValidator();
    console.log('Base script CBOR (first 100 chars):', baseMintingPolicy.compiledCode.substring(0, 100));

    // Check the CBOR encoding level
    const encodingLevel = CBOREncodingLevel(baseMintingPolicy.compiledCode);
    console.log('Script CBOR encoding level:', encodingLevel);

    // Apply the UTxO parameter directly (script from plutus.json should already be properly encoded)
    const parameterizedScript = applyParamsToScript(baseMintingPolicy.compiledCode, [utxoRefData]);
    console.log('✅ Parameterized minting policy script');
    console.log('Parameterized script CBOR (first 100 chars):', parameterizedScript.substring(0, 100));

    // Calculate the hash of the parameterized script - this is the actual policy ID
    const { PlutusV3Script } = await import('@anastasia-labs/cardano-multiplatform-lib-browser');
    const scriptBytes = PlutusV3Script.from_cbor_hex(parameterizedScript);
    const actualPolicyId = scriptBytes.hash().to_hex();
    console.log('Actual policy ID (parameterized):', actualPolicyId);
    console.log('Base policy ID (unparameterized):', MINTING_POLICY_HASH);

    // 3. Create token names with the actual policy ID
    const refTokenName = makeReferenceTokenName(params.assetName);
    const userTokenName = makeUserTokenName(params.assetName);
    const refAssetId = actualPolicyId + refTokenName;
    const userAssetId = actualPolicyId + userTokenName;

    console.log('Reference token:', refAssetId);
    console.log('User token:', userAssetId);
    console.log('Minting quantity:', params.qualifiedMembers.length);

    // 4. Update pact datum with the actual parameterized policy ID
    const correctedPactDatum: GovernancePactDatum = {
      ...params.pactDatum,
      policyId: actualPolicyId, // Use the parameterized policy ID, not the base one
    };
    console.log('✅ Updated pact datum with actual policy ID');

    // 5. Build redeemer with proper Plutus Data serialization
    const mintRedeemer: MintRedeemer = {
      type: 'CreatePact',
      qualifiedMembers: params.qualifiedMembers,
      pactDatum: correctedPactDatum,
    };

    // Convert to Plutus Data structure using Constr, passing script hashes (not Bech32 addresses)
    const redeemerData = mintRedeemerToData(
      mintRedeemer,
      METADATA_VALIDATOR_HASH,
      DISTRIBUTION_VALIDATOR_HASH,
      Constr
    );
    console.log('✅ Redeemer data structure created with Constr');

    // Test simple serialization with Constr
    console.log('\n--- Testing Data Serialization with Constr ---');
    try {
      const testSimple = Data.to(new Constr(0, []));
      console.log('✅ Simple Constr works:', testSimple);

      const testWithBigInt = Data.to(new Constr(0, [42n]));
      console.log('✅ Constr with BigInt works');

      const testWithHex = Data.to(new Constr(0, ["deadbeef"]));
      console.log('✅ Constr with hex string works');

      const testNested = Data.to(new Constr(0, [new Constr(1, ["cafe"])]));
      console.log('✅ Nested Constr works');
    } catch (err) {
      console.error('❌ Test failed:', err);
    }

    // Serialize the redeemer
    let redeemer: string;
    try {
      redeemer = Data.to(redeemerData);
      console.log('✅ Minting redeemer serialized');
      console.log('Redeemer CBOR (first 100 chars):', redeemer.substring(0, 100));
    } catch (err) {
      console.error('Failed to serialize redeemer:', err);
      throw new Error(`Redeemer serialization failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Build metadata for CIP-25
    // Lucid Evolution enforces strict 64-char limit on all metadata string values
    const truncatedTitle = params.pactDatum.title.length > 60
      ? params.pactDatum.title.substring(0, 57) + '...'
      : params.pactDatum.title;

    const truncatedDescription = params.pactDatum.description.length > 60
      ? params.pactDatum.description.substring(0, 57) + '...'
      : params.pactDatum.description;

    // Cardano action IDs are tx_hash#index, can be >64 chars
    const truncatedActionId = params.pactDatum.cardanoActionId.length > 64
      ? params.pactDatum.cardanoActionId.substring(0, 64)
      : params.pactDatum.cardanoActionId;

    const metadata = buildTokenMetadata(
      actualPolicyId,
      userTokenName,
      {
        title: truncatedTitle,
        description: truncatedDescription,
        cardanoActionId: truncatedActionId,
        cardanoActionType: correctedPactDatum.cardanoActionType,
        votingDeadline: correctedPactDatum.votingDeadline,
        totalMembers: correctedPactDatum.totalMembers,
        requiredVotes: correctedPactDatum.requiredVotes,
      },
      {
        // Option 1: Embed image as chunked Base64 array
        // TEMPORARILY DISABLED - Lucid Evolution metadata parser rejects chunked arrays
        // includeImage: true,

        // Option 2: Use IPFS URL instead (recommended for production)
        // imageIpfsUrl: 'ipfs://bafybeig3k2bn4qp8tmzkvy1jrccmkbns5chjhhm',

        // Option 3: No image (smallest transaction, default)
        // ✅ CURRENTLY ACTIVE - will fix chunked array support
      }
    );

    console.log('Metadata size:', JSON.stringify(metadata).length, 'bytes');

    // 5. Use the parameterized minting policy script
    const mintingScript = {
      type: 'PlutusV3' as const,
      script: parameterizedScript,
    };

    // 6. Get validator addresses from script hashes
    const metadataValidatorAddress = getValidatorAddress(lucid, METADATA_VALIDATOR_HASH);
    const distributionValidatorAddress = getValidatorAddress(lucid, DISTRIBUTION_VALIDATOR_HASH);

    console.log('Metadata validator address:', metadataValidatorAddress);
    console.log('Distribution validator address:', distributionValidatorAddress);

    // 7. Build datums with proper Plutus Data serialization using Constr
    // First create the Constr objects, using the corrected pact datum with actual policy ID
    const governancePactDatumData = governancePactDatumToData(
      correctedPactDatum,
      METADATA_VALIDATOR_HASH,
      DISTRIBUTION_VALIDATOR_HASH,
      Constr
    );

    const distributionDatumObj: DistributionDatum = {
      qualifiedMembers: params.qualifiedMembers,
      policyId: actualPolicyId,
      userTokenName: userTokenName,
      totalTokens: params.qualifiedMembers.length,
    };
    const distributionDatumData = distributionDatumToData(distributionDatumObj, Constr);

    // Now serialize them to CBOR for inline datums
    const governancePactDatum = Data.to(governancePactDatumData);
    const distributionDatum = Data.to(distributionDatumData);

    console.log('✅ Datums serialized to CBOR');
    console.log('Governance datum CBOR (first 100 chars):', governancePactDatum.substring(0, 100));
    console.log('Distribution datum CBOR (first 100 chars):', distributionDatum.substring(0, 100));

    // 8. Build transaction
    console.log('\n--- Building Transaction ---');

    // Calculate minimum ADA required for each output
    // Script outputs with datums typically need 2-3 ADA minimum
    const minAdaForScriptOutput = 3_000_000n; // 3 ADA in lovelace

    // Get the UTxO that will be consumed (required by the parameterized minting policy)
    const walletUtxos = await lucid.wallet().getUtxos();
    const utxoToConsume = walletUtxos.find(
      (u) => u.txHash === params.utxoRef.txHash && u.outputIndex === params.utxoRef.outputIndex
    );

    if (!utxoToConsume) {
      throw new Error(`UTxO not found: ${params.utxoRef.txHash}#${params.utxoRef.outputIndex}`);
    }
    console.log('Found UTxO to consume:', params.utxoRef.txHash, '#', params.utxoRef.outputIndex);

    console.log('Step 1: Creating new transaction...');
    const tx = lucid.newTx();

    console.log('Step 2: Collecting UTxO...');
    tx.collectFrom([utxoToConsume]);

    console.log('Step 3: Minting reference token...');
    tx.mintAssets({ [refAssetId]: 1n }, redeemer);

    console.log('Step 4: Minting user tokens...');
    tx.mintAssets({ [userAssetId]: BigInt(params.qualifiedMembers.length) }, redeemer);

    console.log('Step 5: Attaching minting policy...');
    tx.attach.MintingPolicy(mintingScript);

    console.log('Step 6: Sending reference token to metadata validator...');
    tx.pay.ToAddressWithData(
      metadataValidatorAddress,
      { kind: 'inline', value: governancePactDatum },
      { lovelace: minAdaForScriptOutput, [refAssetId]: 1n }
    );

    console.log('Step 7: Sending user tokens to distribution validator...');
    tx.pay.ToAddressWithData(
      distributionValidatorAddress,
      { kind: 'inline', value: distributionDatum },
      { lovelace: minAdaForScriptOutput, [userAssetId]: BigInt(params.qualifiedMembers.length) }
    );

    console.log('Step 8: Attaching metadata...');
    console.log('Full metadata structure:', JSON.stringify(metadata, null, 2));
    console.log('Metadata label 721 content:', JSON.stringify(metadata['721'], null, 2));

    // Check for any non-primitive values
    const checkMetadataValues = (obj: any, path: string = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        console.log(`  ${currentPath}: ${valueType} = ${Array.isArray(value) ? `[${value.length} items]` : JSON.stringify(value).substring(0, 50)}`);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          checkMetadataValues(value, currentPath);
        }
      }
    };
    console.log('Metadata value types:');
    checkMetadataValues(metadata['721']);

    // Metadata is currently disabled due to Lucid Evolution compatibility issues
    // TODO: Debug and fix metadata attachment for governance tokens
    // For now, tokens will be created without on-chain metadata
    console.log('⚠️  Metadata disabled - creating tokens without on-chain metadata');
    console.log('   Tokens will still function correctly, but metadata will not be on-chain');
    // tx.attachMetadata(721, metadata['721']);

    console.log('Step 9: Completing transaction...');
    let completedTx;
    try {
      completedTx = await tx.complete();
      console.log('✅ Transaction built successfully');
    } catch (completeError) {
      console.error('❌ Transaction completion failed');
      console.error('Complete error:', completeError);
      if (completeError && typeof completeError === 'object') {
        const err = completeError as any;
        console.error('Complete error name:', err.name);
        console.error('Complete error message:', err.message);
        console.error('Complete error cause:', err.cause);
        console.error('Complete error stack:', err.stack);

        // Try to extract FiberFailure details
        if (err.cause) {
          console.error('Complete error cause details:', JSON.stringify(err.cause, null, 2));
        }
      }
      throw completeError;
    }

    // 9. Sign transaction with Mesh wallet
    const txCbor = completedTx.toCBOR();
    console.log('Transaction CBOR length:', txCbor.length, 'chars');

    console.log('\n--- Signing Transaction ---');
    const signedTx = await meshWallet.signTx(txCbor, true); // partial sign
    console.log('✅ Transaction signed');

    // 10. Submit transaction
    console.log('\n--- Submitting Transaction ---');
    const txHash = await meshWallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return {
      success: true,
      txHash,
      message: 'CREATE PACT transaction submitted successfully (Lucid Evolution)',
    };
  } catch (error) {
    console.error('\n❌ CREATE PACT transaction failed (Lucid Evolution)');
    console.error('Full error object:', error);

    // Extract detailed error info if available
    if (error && typeof error === 'object') {
      const err = error as any;
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error info:', err.info);
      console.error('Error code:', err.code);
      console.error('Error cause:', err.cause);
      console.error('Error stack:', err.stack);

      // For FiberFailure errors, extract the actual error
      if (err.name === '(FiberFailure) TxBuilderError' || err.cause) {
        console.error('Underlying error cause:', JSON.stringify(err.cause, null, 2));
      }

      // Try to parse the info field if it's a JSON string
      if (err.info && typeof err.info === 'string') {
        try {
          const infoStr = err.info.replace(/^BAD_REQUEST \(/, '').replace(/\)$/, '');
          const parsed = JSON.parse(infoStr);
          console.error('Parsed error details:', JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.error('Could not parse error info');
        }
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to build CREATE PACT transaction',
    };
  }
}

// ============================================================================
// CLAIM TOKEN Transaction (Lucid Evolution)
// ============================================================================

/**
 * Build and submit a CLAIM TOKEN transaction using Lucid Evolution
 *
 * This allows a qualified member to claim their voting token from the Distribution Validator
 *
 * @param meshWallet - Connected Mesh wallet (used for signing)
 * @param params - Claim token parameters
 * @returns Transaction result
 */
export async function buildClaimTokenTx(
  meshWallet: IWallet,
  params: {
    userAddress: string;
    policyId: string;
    userTokenName: string;
    distributionUtxoTxHash: string;
    distributionUtxoIndex: number;
    distributionDatum: DistributionDatum;
  }
) {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   CLAIM TOKEN TRANSACTION (Lucid)      ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 1. Initialize Lucid Evolution
    console.log('Step 1: Initializing Lucid Evolution...');
    const lucid = await initializeLucid();
    await connectMeshWalletToLucid(lucid, meshWallet);
    console.log('✅ Lucid initialized and wallet connected');

    // Import Data and Constr from Lucid Evolution
    const { Data, Constr } = await import('@lucid-evolution/lucid');

    // 2. Get Distribution Validator address and script
    const distributionValidatorAddress = getValidatorAddress(lucid, DISTRIBUTION_VALIDATOR_HASH);
    console.log('Distribution Validator address:', distributionValidatorAddress);

    const distributionValidator = {
      type: 'PlutusV3' as const,
      script: DISTRIBUTION_VALIDATOR_SCRIPT.code,
    };

    // 3. Build the claim redeemer
    console.log('\nStep 2: Building redeemer...');
    const { claimTokenRedeemerToData } = await import('./plutus-data-lucid');
    const redeemerData = claimTokenRedeemerToData(Constr);
    const redeemer = Data.to(redeemerData);
    console.log('✅ Redeemer built (ClaimToken)');

    // 4. Query Distribution Validator UTxO
    console.log('\nStep 3: Querying Distribution Validator UTxO...');
    const distributionUtxoRef = {
      txHash: params.distributionUtxoTxHash,
      outputIndex: params.distributionUtxoIndex,
    };

    // Get all UTxOs at the distribution validator
    const distributionUtxos = await lucid.utxosAt(distributionValidatorAddress);
    console.log(`Found ${distributionUtxos.length} UTxOs at Distribution Validator`);

    // Find the specific UTxO
    const distributionUtxo = distributionUtxos.find(
      utxo =>
        utxo.txHash === distributionUtxoRef.txHash &&
        utxo.outputIndex === distributionUtxoRef.outputIndex
    );

    if (!distributionUtxo) {
      throw new Error(
        `Distribution UTxO not found: ${distributionUtxoRef.txHash}#${distributionUtxoRef.outputIndex}`
      );
    }

    console.log('✅ Found Distribution UTxO');
    console.log('UTxO assets:', distributionUtxo.assets);

    // 5. Calculate token quantities
    const userAssetId = `${params.policyId}${params.userTokenName}`;
    const currentTokenCount = BigInt(distributionUtxo.assets[userAssetId] || 0);

    if (currentTokenCount === 0n) {
      throw new Error('No tokens available in Distribution Validator');
    }

    const remainingTokens = currentTokenCount - 1n;
    console.log(`\nCurrent tokens: ${currentTokenCount}`);
    console.log(`Tokens after claim: ${remainingTokens}`);

    // 6. Build updated distribution datum
    console.log('\nStep 4: Building updated datum...');

    // For now, we keep the same datum (MVP doesn't track claimed members)
    // In production, you would update the qualified_members list
    //
    // The datum from the blockchain is already in Plutus Data format (Constr),
    // so we can use it directly without re-serialization
    const updatedDatumData = new Constr(0, [
      params.distributionDatum.qualifiedMembers,  // Keep as-is (already Plutus Data)
      params.distributionDatum.policyId,
      params.distributionDatum.userTokenName,
      BigInt(remainingTokens),  // Update the token count
    ]);
    const updatedDatum = Data.to(updatedDatumData);
    console.log('✅ Updated datum built');

    // 7. Calculate minimum ADA for outputs
    const minAdaForScriptOutput = 3_000_000n; // 3 ADA minimum for script output
    const minAdaForUserOutput = 2_000_000n; // 2 ADA minimum for user output

    // 8. Build transaction
    console.log('\nStep 5: Building transaction...');

    const tx = lucid
      .newTx()
      // Input: Distribution Validator UTxO with all tokens
      .collectFrom([distributionUtxo], redeemer)
      // Attach Distribution Validator script
      .attach.SpendingValidator(distributionValidator);

    // Output 1: Distribution Validator with (N-1) tokens (only if tokens remain)
    if (remainingTokens > 0n) {
      console.log('Step 6: Sending remaining tokens back to Distribution Validator...');
      tx.pay.ToAddressWithData(
        distributionValidatorAddress,
        { kind: 'inline', value: updatedDatum },
        {
          lovelace: minAdaForScriptOutput,
          [userAssetId]: remainingTokens,
        }
      );
    }

    // Output 2: User wallet with 1 token
    console.log('Step 7: Sending 1 token to user...');
    tx.pay.ToAddress(params.userAddress, {
      lovelace: minAdaForUserOutput,
      [userAssetId]: 1n,
    });

    console.log('\nStep 8: Completing transaction...');
    let completedTx;
    try {
      completedTx = await tx.complete();
      console.log('✅ Transaction built successfully');
    } catch (completeError) {
      console.error('❌ Transaction completion failed');
      console.error('Complete error:', completeError);
      throw completeError;
    }

    // 9. Sign transaction with Mesh wallet
    console.log('\nStep 9: Signing transaction...');
    const txCbor = completedTx.toCBOR();
    const signedTx = await meshWallet.signTx(txCbor, true);
    console.log('✅ Transaction signed');

    // 10. Submit transaction
    console.log('\nStep 10: Submitting transaction...');
    const txHash = await meshWallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return {
      success: true,
      txHash,
      message: 'Voting token claimed successfully',
    };
  } catch (error) {
    console.error('\n❌ CLAIM TOKEN transaction failed');
    console.error('Full error object:', error);

    if (error && typeof error === 'object') {
      const err = error as any;
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to claim voting token',
    };
  }
}

// ============================================================================
// Cast Vote Transaction
// ============================================================================

/**
 * Build Cast Vote Transaction (Lucid Evolution)
 *
 * Sends the user's voting token to the voting validator address with a datum containing the vote
 */
export async function buildCastVoteTx(
  meshWallet: IWallet,
  params: {
    userAddress: string;
    policyId: string;
    userTokenName: string;
    vote: 'Yes' | 'No';
  }
): Promise<{ success: boolean; txHash?: string; error?: string; message?: string }> {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   CAST VOTE TRANSACTION (Lucid)        ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 1. Initialize Lucid Evolution
    console.log('Step 1: Initializing Lucid Evolution...');
    const lucid = await initializeLucid();
    await connectMeshWalletToLucid(lucid, meshWallet);
    console.log('✅ Lucid initialized and wallet connected');

    // 2. Import voting validator and get its address
    const { VOTING_VALIDATOR_HASH } = await import('./contracts');
    const { getValidatorAddress } = await import('./lucid-provider');
    const { Constr, Data } = await import('@lucid-evolution/lucid');

    const votingValidatorAddress = getValidatorAddress(lucid, VOTING_VALIDATOR_HASH);
    console.log('Voting validator address:', votingValidatorAddress);

    // 3. Build vote datum
    console.log('\nStep 2: Building vote datum...');
    const { castVoteRedeemerToData } = await import('./plutus-data-lucid');
    const voteDatum = castVoteRedeemerToData(params.vote, Constr);
    const datum = Data.to(voteDatum);
    console.log(`✅ Datum built (CastVote { vote: ${params.vote} })`);

    // 4. Find user's voting token in wallet
    console.log('\nStep 3: Finding voting token in wallet...');
    const userAssetId = `${params.policyId}${params.userTokenName}`;
    const walletUtxos = await lucid.wallet().getUtxos();

    console.log(`Looking for token: ${userAssetId}`);
    console.log(`Found ${walletUtxos.length} UTxOs in wallet`);

    const tokenUtxo = walletUtxos.find(utxo => {
      const hasToken = userAssetId in utxo.assets && utxo.assets[userAssetId] > 0n;
      if (hasToken) {
        console.log('Found UTxO with voting token:', utxo.txHash);
      }
      return hasToken;
    });

    if (!tokenUtxo) {
      throw new Error('Voting token not found in wallet. You must claim a token first.');
    }

    console.log('✅ Found voting token');
    console.log('Token quantity:', tokenUtxo.assets[userAssetId]);

    // 5. Build transaction - Send token to voting validator
    console.log('\nStep 4: Building transaction...');

    const tx = lucid
      .newTx()
      // Send the voting token to the voting validator with vote datum
      .pay.ToContract(
        votingValidatorAddress,
        { kind: "inline", value: datum },
        { [userAssetId]: 1n }
      );

    console.log('✅ Transaction built');

    // 6. Complete transaction
    console.log('\nStep 5: Completing transaction...');
    let completedTx;
    try {
      completedTx = await tx.complete();
      console.log('✅ Transaction completed');
    } catch (completeError) {
      console.error('❌ Transaction completion failed');
      console.error('Complete error:', completeError);
      throw completeError;
    }

    // 7. Sign transaction with Mesh wallet
    console.log('\nStep 6: Signing transaction...');
    const txCbor = completedTx.toCBOR();
    const signedTx = await meshWallet.signTx(txCbor, true);
    console.log('✅ Transaction signed');

    // 8. Submit transaction
    console.log('\nStep 7: Submitting transaction...');
    const txHash = await meshWallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return {
      success: true,
      txHash,
      message: `Vote cast successfully (${params.vote})`,
    };
  } catch (error) {
    console.error('\n❌ CAST VOTE transaction failed');
    console.error('Full error object:', error);

    if (error && typeof error === 'object') {
      const err = error as any;
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to cast vote',
    };
  }
}
