/**
 * PACT Token Transaction Builder
 *
 * Builds transactions for claiming PACT membership NFTs
 * Uses Lucid Evolution with parameterized minting policy
 */

import type { BrowserWallet } from '@meshsdk/core';
import { PACT_SCRIPT_HASH } from './query-pact-token';
import { PACT_ICON_BLUE_SVG } from './governance-icon';
import { svgToChunkedDataUri } from './base64-chunker';

// PACT token claim cost (10 ADA)
const PACT_CLAIM_COST = 10_000_000; // 10 ADA in lovelace

/**
 * Generate unique PACT token name from user's address
 * Uses blake2b-256 hash to ensure uniqueness
 */
function generatePactTokenName(userAddress: string): string {
  // Import hash function from Lucid
  const { blake2b } = require('blakejs');

  // Hash the address to create unique token name
  const addressBytes = Buffer.from(userAddress, 'utf8');
  const hash = blake2b(addressBytes, null, 32);

  return Buffer.from(hash).toString('hex');
}

/**
 * Build CIP-25 metadata for PACT membership NFT
 */
function buildPactMetadata(
  policyId: string,
  tokenName: string,
  utxoRef: { txHash: string; outputIndex: number }
): any {
  // Convert SVG to chunked base64 data URI (each chunk ≤58 chars to account for JSON overhead)
  const imageChunks = svgToChunkedDataUri(PACT_ICON_BLUE_SVG);

  return {
    '721': {
      [policyId]: {
        [tokenName]: {
          name: 'PACT Membership',
          description: 'blockVote membership token for claiming voting tokens',
          image: imageChunks,
          mediaType: 'image/svg+xml',
          // Custom properties
          membership_type: 'PACT',
          version: '1.0',
          // CRITICAL: Store the UTxO reference used for parameterization
          // Flattened to avoid nested object issues with Cardano metadatum format
          utxo_ref_tx_hash: utxoRef.txHash,
          utxo_ref_output_index: utxoRef.outputIndex.toString(),
        },
      },
    },
  };
}

/**
 * Select a UTxO to use for parameterizing the PACT minting policy
 * This ensures one-time minting
 */
async function selectUtxoForPactMinting(wallet: BrowserWallet) {
  console.log('Selecting UTxO for PACT minting parameterization...');

  const utxos = await wallet.getUtxos();

  if (utxos.length === 0) {
    throw new Error('No UTxOs available in wallet');
  }

  // Find a suitable UTxO with at least the claim cost + fees
  const minLovelace = PACT_CLAIM_COST + 5_000_000; // 10 ADA + 5 ADA for fees

  const suitableUtxos = utxos.filter((utxo) => {
    const lovelace = parseInt(
      utxo.output.amount.find((a) => a.unit === 'lovelace')?.quantity || '0'
    );
    return lovelace >= minLovelace;
  });

  if (suitableUtxos.length === 0) {
    throw new Error(`Insufficient funds. Need at least ${minLovelace / 1_000_000} ADA`);
  }

  // Select random UTxO to avoid conflicts
  const randomIndex = Math.floor(Math.random() * suitableUtxos.length);
  const selected = suitableUtxos[randomIndex];

  console.log(`Selected UTxO ${randomIndex + 1} of ${suitableUtxos.length}`);

  return {
    txHash: selected.input.txHash,
    outputIndex: selected.input.outputIndex,
  };
}

/**
 * Build PACT token claim transaction
 *
 * This transaction:
 * 1. Consumes a specific UTxO (for one-time minting)
 * 2. Mints exactly 1 PACT NFT with unique name
 * 3. Sends the PACT NFT to the user
 *
 * Note: For MVP, we're not locking the 10 ADA deposit at a script.
 * The 10 ADA cost is enforced by the frontend only.
 */
export async function buildClaimPactTx(
  wallet: BrowserWallet,
  userAddress: string
) {
  console.log('🚀 Building CLAIM PACT transaction with Lucid Evolution...');

  try {
    // Import Lucid functions
    const { initializeLucid, connectMeshWalletToLucid } = await import('./lucid-provider');
    const { Constr, Data, toUnit, applyParamsToScript, validatorToScriptHash } = await import('@lucid-evolution/lucid');

    // Fetch plutus.json from public directory
    const plutusJsonResponse = await fetch('/plutus.json');
    if (!plutusJsonResponse.ok) {
      throw new Error('Failed to load plutus.json');
    }
    const plutusJson = await plutusJsonResponse.json();

    // Initialize Lucid and connect wallet
    const lucid = await initializeLucid();
    await connectMeshWalletToLucid(lucid, wallet);

    // Get user's UTxOs from Mesh wallet
    const meshUtxos = await wallet.getUtxos();
    console.log(`Total UTxOs in wallet: ${meshUtxos.length}`);

    // Select UTxO for parameterization
    const utxoRef = await selectUtxoForPactMinting(wallet);
    console.log('Selected UTxO:', utxoRef);

    // Get Lucid UTxOs (already set via connectMeshWalletToLucid)
    const lucidUtxos = await lucid.wallet().getUtxos();
    console.log(`Lucid UTxOs available: ${lucidUtxos.length}`);

    // Find the PACT membership validator in plutus.json
    const pactValidator = plutusJson.validators.find(
      (v: any) => v.title === 'pact_membership.pact_membership.mint'
    );

    if (!pactValidator) {
      throw new Error('PACT membership validator not found in plutus.json');
    }

    console.log('Found PACT validator:', pactValidator.title);

    // Convert UTxO reference to Plutus Data format
    // OutputReference: constructor 0 with fields [transaction_id: ByteArray, output_index: Int]
    const utxoRefData = new Constr(0, [
      utxoRef.txHash, // ByteArray (hex string)
      BigInt(utxoRef.outputIndex), // Int
    ]);

    // Apply the UTxO parameter to create the actual minting policy
    const pactScript = {
      type: "PlutusV3" as const,
      script: applyParamsToScript(
        pactValidator.compiledCode,
        [utxoRefData]
      ),
    };

    // Get the actual policy ID
    const policyId = validatorToScriptHash(pactScript);
    console.log('Parameterized Policy ID:', policyId);

    // Generate unique token name (hash of user address)
    const tokenName = generatePactTokenName(userAddress);
    console.log('Token name:', tokenName);

    // Create the asset unit (policyId + tokenName)
    const assetUnit = toUnit(policyId, tokenName);

    // Create redeemer (ClaimPact constructor - index 0)
    const redeemer = Data.to(new Constr(0, []));

    // Find the selected UTxO in Lucid format
    const selectedLucidUtxo = lucidUtxos.find(u =>
      u.txHash === utxoRef.txHash &&
      u.outputIndex === utxoRef.outputIndex
    );

    if (!selectedLucidUtxo) {
      throw new Error('Selected UTxO not found in Lucid wallet');
    }

    console.log('Selected Lucid UTxO:', selectedLucidUtxo);

    // Build CIP-25 metadata with P icon (include UTxO ref for burning later)
    const metadata = buildPactMetadata(policyId, tokenName, utxoRef);
    console.log('Built PACT metadata with image and UTxO ref');

    // Build the transaction
    const tx = await lucid
      .newTx()
      .collectFrom([selectedLucidUtxo])
      .mintAssets(
        { [assetUnit]: BigInt(1) },
        redeemer
      )
      .attach.MintingPolicy(pactScript)
      .attachMetadata(721, metadata['721'])
      .complete();

    console.log('✅ Transaction built successfully');
    console.log('Transaction details:', {
      policyId,
      tokenName,
      assetUnit,
    });

    // Get the unsigned transaction CBOR
    const unsignedTxCbor = tx.toCBOR();

    // Sign the transaction using Mesh wallet
    const signedTx = await wallet.signTx(unsignedTxCbor, true); // partial sign = true

    // Submit the transaction using Mesh wallet
    const txHash = await wallet.submitTx(signedTx);

    console.log('🎉 PACT token minted! Transaction hash:', txHash);

    return {
      success: true,
      txHash,
      policyId,
      tokenName,
      assetUnit,
    };
  } catch (error) {
    console.error('❌ Failed to build PACT claim transaction:', error);
    throw error;
  }
}

/**
 * Query Blockfrost to find the UTxO reference used to mint a PACT token
 *
 * This looks at the minting transaction and returns ALL inputs,
 * so we can try each one to find which produces the correct policy ID.
 */
async function findPactMintingUtxoRef(policyId: string, assetUnit: string): Promise<{txHash: string, outputIndex: number}[]> {
  const network = process.env.NEXT_PUBLIC_CARDANO_NETWORK || 'preprod';

  // Use network-specific API key (same pattern as other files)
  const blockfrostKey = network === 'preview'
    ? process.env.NEXT_PUBLIC_BLOCKFROST_PREVIEW_API_KEY
    : network === 'preprod'
    ? process.env.NEXT_PUBLIC_BLOCKFROST_PREPROD_API_KEY
    : process.env.NEXT_PUBLIC_BLOCKFROST_MAINNET_API_KEY;

  if (!blockfrostKey) {
    throw new Error(
      `Blockfrost API key not configured for network: ${network}. ` +
      `Please set NEXT_PUBLIC_BLOCKFROST_${network.toUpperCase()}_API_KEY in your .env.local file.`
    );
  }

  const baseUrl = network === 'mainnet'
    ? 'https://cardano-mainnet.blockfrost.io/api/v0'
    : `https://cardano-${network}.blockfrost.io/api/v0`;

  try {
    // Get the minting transactions for this asset
    const response = await fetch(`${baseUrl}/assets/${assetUnit}/transactions?order=asc`, {
      headers: {
        'project_id': blockfrostKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status}`);
    }

    const transactions = await response.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new Error('No minting transaction found for PACT token');
    }

    // The first transaction should be the minting transaction
    const mintTxHash = transactions[0].tx_hash;
    console.log('🔍 Found minting transaction:', mintTxHash);
    console.log(`   View on explorer: https://preview.cardanoscan.io/transaction/${mintTxHash}`);

    // Get the transaction details to find the inputs
    const txResponse = await fetch(`${baseUrl}/txs/${mintTxHash}/utxos`, {
      headers: {
        'project_id': blockfrostKey,
      },
    });

    if (!txResponse.ok) {
      throw new Error(`Failed to fetch transaction UTxOs: ${txResponse.status}`);
    }

    const txUtxos = await txResponse.json();

    // Debug: Log full response structure
    console.log('📦 Full Blockfrost txUtxos response:', JSON.stringify(txUtxos, null, 2));

    if (!txUtxos.inputs || txUtxos.inputs.length === 0) {
      throw new Error('No inputs found in minting transaction');
    }

    console.log(`📥 Number of inputs: ${txUtxos.inputs.length}`);
    txUtxos.inputs.forEach((inp: any, idx: number) => {
      console.log(`   Input ${idx}:`, JSON.stringify(inp, null, 2));
    });

    // Filter out collateral inputs - we only want actual spent inputs
    const nonCollateralInputs = txUtxos.inputs.filter((inp: any) => !inp.collateral);
    console.log(`🔍 Non-collateral inputs: ${nonCollateralInputs.length}`);

    if (nonCollateralInputs.length === 0) {
      throw new Error('No non-collateral inputs found in minting transaction');
    }

    // Return ALL non-collateral inputs - we'll try each one to find which produces the correct policy ID
    const allInputs = nonCollateralInputs.map((inp: any) => ({
      txHash: inp.tx_hash,
      outputIndex: inp.output_index,
    }));

    console.log('All non-collateral inputs in minting transaction:', allInputs);

    // ALSO try different output indices (0-3) in case the reference uses a different index
    const allCandidates: {txHash: string, outputIndex: number}[] = [];
    for (const inp of nonCollateralInputs) {
      // Try the original output index
      allCandidates.push({ txHash: inp.tx_hash, outputIndex: inp.output_index });

      // Also try indices 0-3 if different from the original
      for (let i = 0; i <= 3; i++) {
        if (i !== inp.output_index) {
          allCandidates.push({ txHash: inp.tx_hash, outputIndex: i });
        }
      }
    }

    console.log(`🔍 Total candidates to try (with different indices): ${allCandidates.length}`);

    // EXPERIMENTAL: Also try querying the previous transaction that created the input UTxO
    // The parameterization might have used a UTxO from an earlier transaction
    if (nonCollateralInputs.length > 0) {
      const firstInput = nonCollateralInputs[0];
      console.log(`🔬 Experimental: Trying to find the UTxO that created the input...`);
      console.log(`   Input was created by tx: ${firstInput.tx_hash}#${firstInput.output_index}`);

      // Try querying the transaction that created this UTxO
      try {
        const prevTxResponse = await fetch(`${baseUrl}/txs/${firstInput.tx_hash}/utxos`, {
          headers: { 'project_id': blockfrostKey },
        });

        if (prevTxResponse.ok) {
          const prevTxUtxos = await prevTxResponse.json();
          console.log(`   Previous transaction had ${prevTxUtxos.inputs?.length || 0} inputs`);

          // Try the inputs from the PREVIOUS transaction too
          if (prevTxUtxos.inputs && prevTxUtxos.inputs.length > 0) {
            const prevNonCollateral = prevTxUtxos.inputs.filter((inp: any) => !inp.collateral);
            for (const inp of prevNonCollateral) {
              allCandidates.push({ txHash: inp.tx_hash, outputIndex: inp.output_index });
              // Try multiple indices
              for (let i = 0; i <= 3; i++) {
                if (i !== inp.output_index) {
                  allCandidates.push({ txHash: inp.tx_hash, outputIndex: i });
                }
              }
            }
            console.log(`   Added ${prevNonCollateral.length * 4} more candidates from previous tx`);
          }
        }
      } catch (err) {
        console.log(`   Could not fetch previous transaction:`, err);
      }
    }

    console.log(`🔍 Final total candidates to try: ${allCandidates.length}`);

    return allCandidates;
  } catch (error) {
    console.error('Failed to find minting UTxO ref:', error);
    throw new Error(`Could not find PACT minting UTxO reference: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Build PACT token burn transaction
 *
 * This transaction:
 * 1. Burns the PACT NFT (mint -1)
 * 2. Returns 9 ADA to the user (keeping 1 ADA for fees and cleanup)
 *
 * Implementation notes:
 * - Finds the PACT token in user's wallet
 * - Queries Blockfrost to find the UTxO reference used during minting
 * - Reconstructs the parameterized script with the same UTxO ref
 * - Builds burn transaction with BurnPact redeemer (constructor 1)
 *
 * Future enhancement: Lock 10 ADA at script address during minting,
 * then unlock 9 ADA when burning (requires script address implementation)
 *
 * @param wallet - Mesh wallet instance
 * @param userAddress - User's payment address
 * @returns Transaction result with txHash
 */
export async function buildBurnPactTx(
  wallet: BrowserWallet,
  userAddress: string
) {
  console.log('🔥 Building BURN PACT transaction with Lucid Evolution...');

  try {
    // Import Lucid functions
    const { initializeLucid, connectMeshWalletToLucid } = await import('./lucid-provider');
    const { Constr, Data, fromUnit, applyParamsToScript, validatorToScriptHash } = await import('@lucid-evolution/lucid');

    // Initialize Lucid and connect wallet
    const lucid = await initializeLucid();
    await connectMeshWalletToLucid(lucid, wallet);

    // Get user's UTxOs
    const lucidUtxos = await lucid.wallet().getUtxos();
    console.log(`Total UTxOs in wallet: ${lucidUtxos.length}`);

    // Find the PACT token in the user's wallet
    const expectedTokenName = generatePactTokenName(userAddress);

    let pactUtxo = null;
    let pactAssetUnit = '';
    let pactPolicyId = '';
    let pactTokenName = '';

    for (const utxo of lucidUtxos) {
      const assets = Object.keys(utxo.assets);
      for (const asset of assets) {
        if (asset === 'lovelace') continue;

        const { policyId, name } = fromUnit(asset);

        if (name === expectedTokenName) {
          pactUtxo = utxo;
          pactAssetUnit = asset;
          pactPolicyId = policyId;
          pactTokenName = name;
          break;
        }
      }
      if (pactUtxo) break;
    }

    if (!pactUtxo) {
      throw new Error('PACT token not found in wallet');
    }

    console.log('Found PACT token:', {
      policyId: pactPolicyId,
      tokenName: pactTokenName,
      txHash: pactUtxo.txHash,
    });

    // Fetch plutus.json to get the original validator
    const plutusJsonResponse = await fetch('/plutus.json');
    if (!plutusJsonResponse.ok) {
      throw new Error('Failed to load plutus.json');
    }
    const plutusJson = await plutusJsonResponse.json();

    // Find the PACT membership validator
    const pactValidator = plutusJson.validators.find(
      (v: any) => v.title === 'pact_membership.pact_membership.mint'
    );

    if (!pactValidator) {
      throw new Error('PACT membership validator not found in plutus.json');
    }

    // Try to get UTxO reference from token metadata first (V2 tokens)
    console.log('🔍 Attempting to read UTxO ref from token metadata...');
    let utxoRefFromMetadata: {txHash: string, outputIndex: number} | null = null;

    try {
      // Query Blockfrost for asset metadata
      const network = process.env.NEXT_PUBLIC_CARDANO_NETWORK || 'preprod';
      const blockfrostKey = network === 'preview'
        ? process.env.NEXT_PUBLIC_BLOCKFROST_PREVIEW_API_KEY
        : network === 'preprod'
        ? process.env.NEXT_PUBLIC_BLOCKFROST_PREPROD_API_KEY
        : process.env.NEXT_PUBLIC_BLOCKFROST_MAINNET_API_KEY;

      if (blockfrostKey) {
        const baseUrl = network === 'mainnet'
          ? 'https://cardano-mainnet.blockfrost.io/api/v0'
          : `https://cardano-${network}.blockfrost.io/api/v0`;

        const metadataResponse = await fetch(`${baseUrl}/assets/${pactAssetUnit}`, {
          headers: { 'project_id': blockfrostKey },
        });

        if (metadataResponse.ok) {
          const assetInfo = await metadataResponse.json();
          console.log('📋 Asset metadata:', assetInfo);

          // Check if metadata contains utxo_ref (try both V2 formats)
          if (assetInfo.onchain_metadata?.utxo_ref) {
            // Old format (nested object)
            utxoRefFromMetadata = {
              txHash: assetInfo.onchain_metadata.utxo_ref.tx_hash,
              outputIndex: assetInfo.onchain_metadata.utxo_ref.output_index,
            };
            console.log('✅ Found UTxO ref in metadata (old format):', utxoRefFromMetadata);
          } else if (assetInfo.onchain_metadata?.utxo_ref_tx_hash) {
            // New format (flattened)
            utxoRefFromMetadata = {
              txHash: assetInfo.onchain_metadata.utxo_ref_tx_hash,
              outputIndex: parseInt(assetInfo.onchain_metadata.utxo_ref_output_index),
            };
            console.log('✅ Found UTxO ref in metadata (new format):', utxoRefFromMetadata);
          }
        }
      }
    } catch (err) {
      console.log('⚠️  Could not read metadata:', err);
    }

    let pactScript = null;
    let matchedUtxoRef = null;

    // If we found the UTxO ref in metadata, use it directly
    if (utxoRefFromMetadata) {
      console.log('🎯 Using UTxO ref from metadata (V2 token)');
      const utxoRefData = new Constr(0, [
        utxoRefFromMetadata.txHash,
        BigInt(utxoRefFromMetadata.outputIndex),
      ]);

      pactScript = {
        type: "PlutusV3" as const,
        script: applyParamsToScript(pactValidator.compiledCode, [utxoRefData]),
      };

      const reconstructedPolicyId = validatorToScriptHash(pactScript);
      console.log('   Reconstructed policy ID:', reconstructedPolicyId);
      console.log('   Expected policy ID:     ', pactPolicyId);

      if (reconstructedPolicyId === pactPolicyId) {
        console.log('✅ Policy ID match confirmed!');
        matchedUtxoRef = utxoRefFromMetadata;
      } else {
        console.log('❌ Policy ID mismatch - metadata may be incorrect');
        pactScript = null;
      }
    }

    // Fallback: Query Blockfrost and try candidates (for V1 tokens without metadata)
    if (!pactScript) {
      console.log('🔄 Falling back to Blockfrost query (V1 token without metadata)');
      const candidateUtxoRefs = await findPactMintingUtxoRef(pactPolicyId, pactAssetUnit);
      console.log(`Found ${candidateUtxoRefs.length} candidate UTxO refs`);

      for (const utxoRef of candidateUtxoRefs) {
        console.log('🔧 Trying UTxO ref:', utxoRef);

        const utxoRefData = new Constr(0, [
          utxoRef.txHash,
          BigInt(utxoRef.outputIndex),
        ]);

        const testScript = {
          type: "PlutusV3" as const,
          script: applyParamsToScript(pactValidator.compiledCode, [utxoRefData]),
        };

        const reconstructedPolicyId = validatorToScriptHash(testScript);
        console.log('   Reconstructed policy ID:', reconstructedPolicyId);
        console.log('   Expected policy ID:     ', pactPolicyId);
        console.log('   Match:', reconstructedPolicyId === pactPolicyId);

        if (reconstructedPolicyId === pactPolicyId) {
          console.log('✅ Policy ID match found!');
          pactScript = testScript;
          matchedUtxoRef = utxoRef;
          break;
        }
      }
    }

    if (!pactScript || !matchedUtxoRef) {
      throw new Error(
        `Could not find matching UTxO reference for policy ID: ${pactPolicyId}. ` +
        `This token may have been minted with an older version. Please contact support.`
      );
    }

    console.log('✅ Successfully reconstructed PACT minting policy');
    console.log('   Using UTxO ref:', matchedUtxoRef);

    // Create burn redeemer (BurnPact is constructor 1)
    const redeemer = Data.to(new Constr(1, []));

    // Build the transaction to burn the PACT token and return 9 ADA
    const tx = await lucid
      .newTx()
      .collectFrom([pactUtxo])
      .mintAssets(
        { [pactAssetUnit]: BigInt(-1) }, // Burn 1 token
        redeemer
      )
      .attach.MintingPolicy(pactScript) // Attach the parameterized script
      .pay.ToAddress(userAddress, { lovelace: BigInt(9_000_000) }) // Return 9 ADA
      .complete();

    console.log('✅ Burn transaction built successfully');

    // Get the unsigned transaction CBOR
    const unsignedTxCbor = tx.toCBOR();

    // Sign the transaction using Mesh wallet
    const signedTx = await wallet.signTx(unsignedTxCbor, true);

    // Submit the transaction
    const txHash = await wallet.submitTx(signedTx);

    console.log('🎉 PACT token burned! Transaction hash:', txHash);

    return {
      success: true,
      txHash,
      policyId: pactPolicyId,
      tokenName: pactTokenName,
      assetUnit: pactAssetUnit,
    };
  } catch (error) {
    console.error('❌ Failed to build PACT burn transaction:', error);
    throw error;
  }
}

/**
 * Estimate transaction fee for PACT claiming
 */
export async function estimatePactClaimFee(): Promise<number> {
  // Rough estimate: minting transaction typically costs 0.3-0.5 ADA
  return 500_000; // 0.5 ADA in lovelace
}
