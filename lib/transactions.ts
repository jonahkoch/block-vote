/**
 * BlockVote Transaction Builders
 *
 * Mesh SDK transaction builders for smart contract interactions
 */

import { BrowserWallet, Transaction, resolvePaymentKeyHash, serializePlutusScript } from '@meshsdk/core';
import type {
  CreatePactParams,
  GovernancePactDatum,
  DistributionDatum,
  MintRedeemer,
  Credential,
  TxBuildResult,
} from '../types/contracts';
import {
  getMintingPolicyValidator,
  getMetadataValidator,
  getDistributionValidator,
  MINTING_POLICY_HASH,
  METADATA_VALIDATOR_SCRIPT,
  DISTRIBUTION_VALIDATOR_SCRIPT,
  METADATA_VALIDATOR_HASH,
  DISTRIBUTION_VALIDATOR_HASH,
  makeReferenceTokenName,
  makeUserTokenName,
  stringToHex,
} from './contracts';
import { buildTokenMetadata } from './metadata';

// ============================================================================
// CREATE PACT Transaction
// ============================================================================

/**
 * Build and submit a CREATE PACT transaction
 *
 * This mints CIP-068 dual tokens:
 * - 1 Reference Token → Metadata Validator
 * - N User Tokens → Distribution Validator
 *
 * @param wallet - Connected Mesh wallet
 * @param params - Create pact parameters
 * @returns Transaction result
 */
export async function buildCreatePactTx(
  wallet: BrowserWallet,
  params: CreatePactParams
): Promise<TxBuildResult> {
  try {
    // 1. Create token names
    const refTokenName = makeReferenceTokenName(params.assetName);
    const userTokenName = makeUserTokenName(params.assetName);

    // 2. Build redeemer
    // TEMPORARY: Using empty redeemer for MVP testing
    // TODO: Properly serialize CreatePact redeemer with Plutus Data format
    const redeemer = {
      data: { alternative: 0, fields: [] }, // Empty constructor
    };

    console.log('WARNING: Using empty redeemer - transaction will fail validator checks');

    // 3. Build metadata for CIP-25
    // Truncate description to avoid transaction size issues
    const truncatedDescription = params.pactDatum.description.length > 200
      ? params.pactDatum.description.substring(0, 197) + '...'
      : params.pactDatum.description;

    console.log('Original description length:', params.pactDatum.description.length);
    console.log('Truncated description length:', truncatedDescription.length);

    const metadata = buildTokenMetadata(
      MINTING_POLICY_HASH,
      userTokenName, // Use user token for wallet display
      {
        title: params.pactDatum.title,
        description: truncatedDescription, // Use truncated version
        cardanoActionId: params.pactDatum.cardanoActionId,
        cardanoActionType: params.pactDatum.cardanoActionType,
        votingDeadline: params.pactDatum.votingDeadline,
        totalMembers: params.pactDatum.totalMembers,
        requiredVotes: params.pactDatum.requiredVotes,
      }
    );

    // Log metadata size
    const metadataJson = JSON.stringify(metadata);
    console.log('Metadata size (bytes):', metadataJson.length);
    console.log('Metadata size (KB):', (metadataJson.length / 1024).toFixed(2));

    // 4. Build distribution datum
    const distributionDatum: DistributionDatum = {
      qualifiedMembers: params.qualifiedMembers,
      policyId: MINTING_POLICY_HASH,
      userTokenName: userTokenName,
      totalTokens: params.qualifiedMembers.length,
    };

    // 5. Get validator script
    const mintingPolicy = getMintingPolicyValidator();

    // 6. Build transaction
    const tx = new Transaction({
      initiator: wallet,
      // Explicitly set network to preprod (1)
      // 0 = preview, 1 = preprod, 2 = mainnet
    }).setNetwork('preprod');

    // Set change address explicitly
    const changeAddress = await wallet.getChangeAddress();
    console.log('Change address for transaction:', changeAddress);
    tx.setChangeAddress(changeAddress);

    // Set collateral for Plutus script execution
    // Plutus scripts require collateral UTxOs
    const collateral = await wallet.getCollateral();
    if (collateral && collateral.length > 0) {
      console.log('Setting collateral:', collateral.length, 'UTxO(s)');
      tx.setCollateral(collateral);
    } else {
      console.warn('WARNING: No collateral UTxOs available - Plutus scripts require collateral');
    }

    // Note: For one-time minting, the UTxO consumption is handled by the
    // parameterized minting policy validator. We don't need to explicitly
    // add it as an input here - Mesh SDK will automatically include wallet
    // UTxOs when building the transaction.

    // For Mesh SDK v1.9, we need to use the script directly
    // The minting policy is a Plutus script that needs to be provided
    const script = {
      code: mintingPolicy.compiledCode,
      version: 'V3',
    };

    console.log('Minting script hash:', mintingPolicy.hash);
    console.log('Minting ref token:', refTokenName);
    console.log('Minting user token:', userTokenName, 'quantity:', params.qualifiedMembers.length);

    // Try minting with explicit version specification
    console.log('Attempting to mint with Plutus V3 script');

    // Mint both tokens with the same script and redeemer
    // Reference token (quantity: 1)
    tx.mintAsset(
      script,
      {
        assetName: refTokenName,
        assetQuantity: '1',
      },
      redeemer
    );

    // User tokens (quantity: N)
    tx.mintAsset(
      script,
      {
        assetName: userTokenName,
        assetQuantity: params.qualifiedMembers.length.toString(),
      },
      redeemer
    );

    // Output 1: Reference token to metadata validator
    // Serialize the validator script to get proper address
    // Network ID: 0 = testnet (preview/preprod), 1 = mainnet
    const metadataValidatorAddress = serializePlutusScript(
      METADATA_VALIDATOR_SCRIPT,
      undefined,
      0 // 0 = testnet (preprod/preview)
    ).address;

    console.log('Metadata validator address:', metadataValidatorAddress);
    console.log('Pact datum for metadata validator:', JSON.stringify(params.pactDatum, null, 2));

    // TEMPORARY: Send assets WITHOUT datum for MVP testing
    // TODO: Add proper Plutus Data serialization for datums
    console.log('WARNING: Sending tokens without datums for MVP testing');
    console.log('This transaction will FAIL on-chain validation but should build and sign');

    tx.sendAssets(
      metadataValidatorAddress,
      [
        {
          unit: MINTING_POLICY_HASH + refTokenName,
          quantity: '1',
        },
      ]
    );

    // Output 2: User tokens to distribution validator
    const distributionValidatorAddress = serializePlutusScript(
      DISTRIBUTION_VALIDATOR_SCRIPT,
      undefined,
      0 // 0 = testnet (preprod/preview)
    ).address;

    console.log('Distribution validator address:', distributionValidatorAddress);
    console.log('Distribution datum:', JSON.stringify(distributionDatum, null, 2));

    tx.sendAssets(
      distributionValidatorAddress,
      [
        {
          unit: MINTING_POLICY_HASH + userTokenName,
          quantity: params.qualifiedMembers.length.toString(),
        },
      ]
    );

    // Add CIP-25 metadata (with truncated description)
    tx.setMetadata(721, metadata['721']);

    // Set required signers (user must sign)
    tx.setRequiredSigners([params.userAddress]);

    // Debug: Log transaction details before building
    console.log('=== TRANSACTION BUILD ATTEMPT ===');
    console.log('User address:', params.userAddress);
    console.log('Minting policy hash:', MINTING_POLICY_HASH);
    console.log('Reference token:', MINTING_POLICY_HASH + refTokenName);
    console.log('User token:', MINTING_POLICY_HASH + userTokenName);
    console.log('User token quantity:', params.qualifiedMembers.length.toString());
    console.log('Metadata validator address:', metadataValidatorAddress);
    console.log('Distribution validator address:', distributionValidatorAddress);
    console.log('Metadata entries:', Object.keys(metadata['721']).length);
    console.log('Required signers:', [params.userAddress]);
    console.log('Attempting to build transaction...');

    // Build and sign
    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    return {
      success: true,
      txHash,
    };
  } catch (error) {
    console.error('Error building CREATE PACT transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert wallet address to Credential
 * @param address - Bech32 address
 * @returns Credential object
 */
export async function addressToCredential(address: string): Promise<Credential> {
  try {
    const keyHash = resolvePaymentKeyHash(address);
    return {
      type: 'VerificationKey',
      hash: keyHash,
    };
  } catch (error) {
    throw new Error(`Failed to convert address to credential: ${error}`);
  }
}

/**
 * Convert list of addresses to credentials
 */
export async function addressesToCredentials(addresses: string[]): Promise<Credential[]> {
  return Promise.all(addresses.map(addressToCredential));
}

/**
 * Get user's UTxOs from wallet
 * @param wallet - Connected Mesh wallet
 * @returns List of UTxOs
 */
export async function getUserUtxos(wallet: BrowserWallet) {
  try {
    const utxos = await wallet.getUtxos();
    return utxos;
  } catch (error) {
    console.error('Error fetching UTxOs:', error);
    return [];
  }
}

/**
 * Select a UTxO for one-time minting
 * Chooses the first available UTxO with enough ADA
 * @param wallet - Connected Mesh wallet
 * @param minLovelace - Minimum lovelace required (default: 2 ADA)
 * @returns Selected UTxO reference
 */
export async function selectUtxoForMinting(
  wallet: BrowserWallet,
  minLovelace: number = 2_000_000
) {
  const utxos = await getUserUtxos(wallet);

  console.log('Total UTxOs in wallet:', utxos.length);

  if (utxos.length === 0) {
    throw new Error('No UTxOs available in wallet');
  }

  // Log all UTxOs for debugging
  utxos.forEach((utxo, idx) => {
    const lovelace = parseInt(utxo.output.amount.find((a) => a.unit === 'lovelace')?.quantity || '0');
    const otherAssets = utxo.output.amount.filter((a) => a.unit !== 'lovelace');
    console.log(`UTxO ${idx}: ${lovelace / 1_000_000} ADA, ${otherAssets.length} other assets`);
  });

  // Find all UTxOs with sufficient ADA
  const suitableUtxos = utxos.filter((utxo) => {
    const lovelace = parseInt(utxo.output.amount.find((a) => a.unit === 'lovelace')?.quantity || '0');
    return lovelace >= minLovelace;
  });

  if (suitableUtxos.length === 0) {
    throw new Error(`No UTxO found with at least ${minLovelace / 1_000_000} ADA`);
  }

  // Select a random UTxO from suitable ones to avoid reusing the same one
  // This is important because the parameterized minting policy consumes the UTxO
  const randomIndex = Math.floor(Math.random() * suitableUtxos.length);
  const selected = suitableUtxos[randomIndex];

  console.log(`Selected UTxO ${randomIndex + 1} of ${suitableUtxos.length} suitable UTxOs`);

  return {
    txHash: selected.input.txHash,
    outputIndex: selected.input.outputIndex,
  };
}
