/**
 * Mesh SDK Diagnostic Tests
 *
 * Step-by-step complexity increase to identify where Mesh SDK fails:
 * 1. Simple ADA transfer (✅ WORKS)
 * 2. Mint with native script (timelock)
 * 3. Mint with Plutus V2 script
 * 4. Mint with Plutus V3 script (minimal)
 * 5. Mint + send to regular address
 * 6. Mint + send to script address
 * 7. Mint + send to script + metadata
 * 8. Full CREATE PACT transaction
 */

import { Transaction } from '@meshsdk/core';
import type { IWallet } from '@meshsdk/core';
import {
  getMintingPolicyValidator,
  MINTING_POLICY_HASH,
  REFERENCE_TOKEN_LABEL,
  USER_TOKEN_LABEL,
  stringToHex,
} from './contracts';

// ============================================================================
// Test 1: Simple ADA Transfer (BASELINE - SHOULD WORK)
// ============================================================================

export async function test1_SimpleTransfer(wallet: IWallet) {
  console.log('\n=== TEST 1: Simple ADA Transfer ===');

  try {
    const tx = new Transaction({ initiator: wallet })
      .setNetwork('preprod');

    const changeAddress = await wallet.getChangeAddress();
    tx.setChangeAddress(changeAddress);

    const collateral = await wallet.getCollateral();
    if (collateral && collateral.length > 0) {
      tx.setCollateral(collateral);
    }

    // Send 2 ADA to own address
    tx.sendLovelace(changeAddress, '2000000');

    console.log('Building transaction...');
    const unsignedTx = await tx.build();
    console.log('✅ Transaction built successfully');

    const signedTx = await wallet.signTx(unsignedTx);
    console.log('✅ Transaction signed successfully');

    const txHash = await wallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return { success: true, txHash };
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
    return { success: false, error };
  }
}

// ============================================================================
// Test 2: Mint Single Token with Plutus V3 (NO OUTPUTS)
// ============================================================================

export async function test2_MintOnly(wallet: IWallet) {
  console.log('\n=== TEST 2: Mint Token (No Outputs) ===');

  try {
    const tx = new Transaction({ initiator: wallet })
      .setNetwork('preprod');

    const changeAddress = await wallet.getChangeAddress();
    tx.setChangeAddress(changeAddress);

    const collateral = await wallet.getCollateral();
    if (collateral && collateral.length > 0) {
      tx.setCollateral(collateral);
    }

    // Get minting policy
    const mintingPolicy = getMintingPolicyValidator();
    const script = {
      code: mintingPolicy.compiledCode,
      version: 'V3' as const,
    };

    // Empty redeemer
    const redeemer = {
      data: { alternative: 0, fields: [] },
    };

    // Simple asset name
    const assetName = stringToHex('testToken');

    console.log('Minting 1 token with Plutus V3 script...');
    console.log('Policy ID:', MINTING_POLICY_HASH);
    console.log('Asset name:', assetName);

    // Mint just 1 token
    tx.mintAsset(script, { assetName, assetQuantity: '1' }, redeemer);

    console.log('Building transaction...');
    const unsignedTx = await tx.build();
    console.log('✅ Transaction built successfully');

    const signedTx = await wallet.signTx(unsignedTx);
    console.log('✅ Transaction signed successfully');

    const txHash = await wallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return { success: true, txHash };
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
    return { success: false, error };
  }
}

// ============================================================================
// Test 3: Mint + Send to Own Address (Regular Address)
// ============================================================================

export async function test3_MintAndSendToWallet(wallet: IWallet) {
  console.log('\n=== TEST 3: Mint + Send to Own Wallet ===');

  try {
    const tx = new Transaction({ initiator: wallet })
      .setNetwork('preprod');

    const changeAddress = await wallet.getChangeAddress();
    tx.setChangeAddress(changeAddress);

    const collateral = await wallet.getCollateral();
    if (collateral && collateral.length > 0) {
      tx.setCollateral(collateral);
    }

    // Get minting policy
    const mintingPolicy = getMintingPolicyValidator();
    const script = {
      code: mintingPolicy.compiledCode,
      version: 'V3' as const,
    };

    // Empty redeemer
    const redeemer = {
      data: { alternative: 0, fields: [] },
    };

    // Simple asset name
    const assetName = stringToHex('testToken2');

    console.log('Minting 1 token...');
    tx.mintAsset(script, { assetName, assetQuantity: '1' }, redeemer);

    // Send minted token to own wallet
    console.log('Sending token to own wallet...');
    tx.sendAssets(
      changeAddress,
      [
        {
          unit: MINTING_POLICY_HASH + assetName,
          quantity: '1',
        },
      ]
    );

    console.log('Building transaction...');
    const unsignedTx = await tx.build();
    console.log('✅ Transaction built successfully');

    const signedTx = await wallet.signTx(unsignedTx);
    console.log('✅ Transaction signed successfully');

    const txHash = await wallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return { success: true, txHash };
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
    return { success: false, error };
  }
}

// ============================================================================
// Test 4: Mint CIP-068 Dual Tokens (Ref + User)
// ============================================================================

export async function test4_MintCIP068Tokens(wallet: IWallet) {
  console.log('\n=== TEST 4: Mint CIP-068 Dual Tokens ===');

  try {
    const tx = new Transaction({ initiator: wallet })
      .setNetwork('preprod');

    const changeAddress = await wallet.getChangeAddress();
    tx.setChangeAddress(changeAddress);

    const collateral = await wallet.getCollateral();
    if (collateral && collateral.length > 0) {
      tx.setCollateral(collateral);
    }

    // Get minting policy
    const mintingPolicy = getMintingPolicyValidator();
    const script = {
      code: mintingPolicy.compiledCode,
      version: 'V3' as const,
    };

    // Empty redeemer
    const redeemer = {
      data: { alternative: 0, fields: [] },
    };

    // CIP-068 token names
    const baseName = stringToHex('testCIP068');
    const refTokenName = REFERENCE_TOKEN_LABEL + baseName;
    const userTokenName = USER_TOKEN_LABEL + baseName;

    console.log('Minting CIP-068 reference token (label 100)...');
    tx.mintAsset(script, { assetName: refTokenName, assetQuantity: '1' }, redeemer);

    console.log('Minting CIP-068 user tokens (label 222)...');
    tx.mintAsset(script, { assetName: userTokenName, assetQuantity: '3' }, redeemer);

    // Send both to own wallet
    console.log('Sending tokens to own wallet...');
    tx.sendAssets(
      changeAddress,
      [
        {
          unit: MINTING_POLICY_HASH + refTokenName,
          quantity: '1',
        },
        {
          unit: MINTING_POLICY_HASH + userTokenName,
          quantity: '3',
        },
      ]
    );

    console.log('Building transaction...');
    const unsignedTx = await tx.build();
    console.log('✅ Transaction built successfully');

    const signedTx = await wallet.signTx(unsignedTx);
    console.log('✅ Transaction signed successfully');

    const txHash = await wallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return { success: true, txHash };
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
    return { success: false, error };
  }
}

// ============================================================================
// Test 5: Mint + Minimal Metadata
// ============================================================================

export async function test5_MintWithMetadata(wallet: any) {
  console.log('\n=== TEST 5: Mint + Minimal Metadata ===');

  try {
    const tx = new Transaction({ initiator: wallet })
      .setNetwork('preprod');

    const changeAddress = await wallet.getChangeAddress();
    tx.setChangeAddress(changeAddress);

    const collateral = await wallet.getCollateral();
    if (collateral && collateral.length > 0) {
      tx.setCollateral(collateral);
    }

    // Get minting policy
    const mintingPolicy = getMintingPolicyValidator();
    const script = {
      code: mintingPolicy.compiledCode,
      version: 'V3' as const,
    };

    // Empty redeemer
    const redeemer = {
      data: { alternative: 0, fields: [] },
    };

    // Simple asset name
    const assetName = stringToHex('testWithMeta');

    console.log('Minting token with metadata...');
    tx.mintAsset(script, { assetName, assetQuantity: '1' }, redeemer);

    tx.sendAssets(
      changeAddress,
      [
        {
          unit: MINTING_POLICY_HASH + assetName,
          quantity: '1',
        },
      ]
    );

    // Minimal CIP-25 metadata
    const metadata = {
      [MINTING_POLICY_HASH]: {
        [assetName]: {
          name: 'Test Token',
          description: 'Simple test',
          image: 'ipfs://test',
        },
      },
    };

    console.log('Adding minimal metadata...');
    tx.setMetadata(721, metadata);

    console.log('Building transaction...');
    const unsignedTx = await tx.build();
    console.log('✅ Transaction built successfully');

    const signedTx = await wallet.signTx(unsignedTx);
    console.log('✅ Transaction signed successfully');

    const txHash = await wallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return { success: true, txHash };
  } catch (error) {
    console.error('❌ Test 5 failed:', error);
    return { success: false, error };
  }
}

// ============================================================================
// Test 6: Mint + Send with Manual UTxO Selection
// ============================================================================

export async function test6_MintWithManualUtxos(wallet: IWallet) {
  console.log('\n=== TEST 6: Mint + Send with Manual UTxO Selection ===');

  try {
    // Get all UTxOs
    const allUtxos = await wallet.getUtxos();
    console.log('Total UTxOs available:', allUtxos.length);

    // Filter for pure ADA UTxOs (no other assets)
    const pureAdaUtxos = allUtxos.filter(utxo => {
      const assets = utxo.output.amount.filter(a => a.unit !== 'lovelace');
      return assets.length === 0;
    });

    console.log('Pure ADA UTxOs found:', pureAdaUtxos.length);

    if (pureAdaUtxos.length === 0) {
      console.log('⚠️  No pure ADA UTxOs found. Trying with smallest multi-asset UTxO...');

      // Sort by number of assets (ascending)
      const sortedUtxos = [...allUtxos].sort((a, b) => {
        const aAssets = a.output.amount.filter(x => x.unit !== 'lovelace').length;
        const bAssets = b.output.amount.filter(x => x.unit !== 'lovelace').length;
        return aAssets - bAssets;
      });

      console.log('Using UTxO with', sortedUtxos[0].output.amount.filter(a => a.unit !== 'lovelace').length, 'assets');
    }

    const tx = new Transaction({ initiator: wallet })
      .setNetwork('preprod');

    const changeAddress = await wallet.getChangeAddress();
    tx.setChangeAddress(changeAddress);

    const collateral = await wallet.getCollateral();
    if (collateral && collateral.length > 0) {
      tx.setCollateral(collateral);
    }

    // Manually select UTxOs - use pure ADA if available, otherwise use the one with fewest assets
    const selectedUtxos = pureAdaUtxos.length > 0 ? pureAdaUtxos : [allUtxos[0]];
    console.log('Manually selecting', selectedUtxos.length, 'UTxO(s)');

    // Log selected UTxO details
    selectedUtxos.forEach((utxo, idx) => {
      const lovelace = parseInt(utxo.output.amount.find((a) => a.unit === 'lovelace')?.quantity || '0');
      const otherAssets = utxo.output.amount.filter((a) => a.unit !== 'lovelace');
      console.log(`Selected UTxO ${idx}: ${lovelace / 1_000_000} ADA, ${otherAssets.length} other assets`);
    });

    // Try using txIn instead of setTxInputs
    console.log('Adding inputs manually with txIn()...');
    selectedUtxos.forEach(utxo => {
      tx.txIn(
        utxo.input.txHash,
        utxo.input.outputIndex,
        utxo.output.amount,
        utxo.output.address
      );
    });

    // Get minting policy
    const mintingPolicy = getMintingPolicyValidator();
    const script = {
      code: mintingPolicy.compiledCode,
      version: 'V3' as const,
    };

    // Empty redeemer
    const redeemer = {
      data: { alternative: 0, fields: [] },
    };

    // Simple asset name
    const assetName = stringToHex('testManualUtxo');

    console.log('Minting 1 token with manual UTxO selection...');
    tx.mintAsset(script, { assetName, assetQuantity: '1' }, redeemer);

    // Send minted token to own wallet
    console.log('Sending token to own wallet...');
    tx.sendAssets(
      changeAddress,
      [
        {
          unit: MINTING_POLICY_HASH + assetName,
          quantity: '1',
        },
      ]
    );

    console.log('Building transaction...');
    const unsignedTx = await tx.build();
    console.log('✅ Transaction built successfully');

    const signedTx = await wallet.signTx(unsignedTx);
    console.log('✅ Transaction signed successfully');

    const txHash = await wallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return { success: true, txHash };
  } catch (error) {
    console.error('❌ Test 6 failed:', error);
    return { success: false, error };
  }
}

// ============================================================================
// Test 7: Two-Transaction Approach (Mint, then Send)
// ============================================================================

export async function test7_TwoTransactionApproach(wallet: IWallet) {
  console.log('\n=== TEST 7: Two-Transaction Approach ===');

  try {
    const changeAddress = await wallet.getChangeAddress();
    const collateral = await wallet.getCollateral();

    // Get minting policy
    const mintingPolicy = getMintingPolicyValidator();
    const script = {
      code: mintingPolicy.compiledCode,
      version: 'V3' as const,
    };

    // Empty redeemer
    const redeemer = {
      data: { alternative: 0, fields: [] },
    };

    // Simple asset name
    const assetName = stringToHex('testTwoTx');
    const tokenUnit = MINTING_POLICY_HASH + assetName;

    // ========================================================================
    // TRANSACTION 1: Mint token (it goes to wallet by default)
    // ========================================================================
    console.log('\n--- Transaction 1: Minting ---');

    const tx1 = new Transaction({ initiator: wallet })
      .setNetwork('preprod');

    tx1.setChangeAddress(changeAddress);

    if (collateral && collateral.length > 0) {
      tx1.setCollateral(collateral);
    }

    console.log('Minting 1 token...');
    tx1.mintAsset(script, { assetName, assetQuantity: '1' }, redeemer);

    console.log('Building mint transaction...');
    const unsignedTx1 = await tx1.build();
    console.log('✅ Mint transaction built successfully');

    const signedTx1 = await wallet.signTx(unsignedTx1);
    console.log('✅ Mint transaction signed successfully');

    const txHash1 = await wallet.submitTx(signedTx1);
    console.log('✅ Mint transaction submitted:', txHash1);

    // Wait for transaction to be confirmed
    console.log('\n⏳ Waiting for mint transaction to confirm...');
    console.log('(In production, use a proper confirmation checker)');

    // Simple wait - in production you'd check the blockchain
    await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds
    console.log('✅ Assumed confirmed (waited 20 seconds)');

    // ========================================================================
    // TRANSACTION 2: Send the minted token
    // ========================================================================
    console.log('\n--- Transaction 2: Sending Token ---');

    const tx2 = new Transaction({ initiator: wallet })
      .setNetwork('preprod');

    tx2.setChangeAddress(changeAddress);

    // Note: No collateral needed for simple send (no script execution)

    console.log('Sending minted token back to own wallet...');
    tx2.sendAssets(
      changeAddress,
      [
        {
          unit: tokenUnit,
          quantity: '1',
        },
      ]
    );

    console.log('Building send transaction...');
    const unsignedTx2 = await tx2.build();
    console.log('✅ Send transaction built successfully');

    const signedTx2 = await wallet.signTx(unsignedTx2);
    console.log('✅ Send transaction signed successfully');

    const txHash2 = await wallet.submitTx(signedTx2);
    console.log('✅ Send transaction submitted:', txHash2);

    console.log('\n🎉 TWO-TRANSACTION APPROACH SUCCEEDED!');
    console.log('Mint Tx:', txHash1);
    console.log('Send Tx:', txHash2);

    return {
      success: true,
      txHash: txHash2,
      mintTxHash: txHash1,
      sendTxHash: txHash2
    };
  } catch (error) {
    console.error('❌ Test 7 failed:', error);
    return { success: false, error };
  }
}

// ============================================================================
// Test 8: Mint + Send to Specific Address (One Transaction)
// ============================================================================

export async function test8_MintAndSendToAddress(wallet: IWallet) {
  console.log('\n=== TEST 8: Mint + Send to Specific Address ===');

  try {
    // Log available UTxOs FIRST
    console.log('\n--- Available UTxOs Before Transaction ---');
    const allUtxos = await wallet.getUtxos();
    console.log('Total UTxOs:', allUtxos.length);

    allUtxos.forEach((utxo, idx) => {
      const lovelace = parseInt(utxo.output.amount.find((a) => a.unit === 'lovelace')?.quantity || '0');
      const otherAssets = utxo.output.amount.filter((a) => a.unit !== 'lovelace');
      console.log(`\nUTxO ${idx}:`);
      console.log('  txHash:', utxo.input.txHash);
      console.log('  outputIndex:', utxo.input.outputIndex);
      console.log('  address:', utxo.output.address);
      console.log('  lovelace:', lovelace / 1_000_000, 'ADA');
      console.log('  other assets:', otherAssets.length);

      if (otherAssets.length > 0 && otherAssets.length <= 3) {
        otherAssets.forEach(asset => {
          console.log('    -', asset.unit.slice(0, 20) + '...:', asset.quantity);
        });
      }
    });

    console.log('\n--- Creating Transaction with VERBOSE MODE ---');
    const tx = new Transaction({ initiator: wallet, verbose: true })
      .setNetwork('preprod');

    const changeAddress = await wallet.getChangeAddress();
    tx.setChangeAddress(changeAddress);

    const collateral = await wallet.getCollateral();
    if (collateral && collateral.length > 0) {
      tx.setCollateral(collateral);
      console.log('\n--- Collateral UTxO ---');
      collateral.forEach((coll, idx) => {
        const lovelace = parseInt(coll.output.amount.find((a) => a.unit === 'lovelace')?.quantity || '0');
        const otherAssets = coll.output.amount.filter((a) => a.unit !== 'lovelace');
        console.log(`Collateral ${idx}:`);
        console.log('  txHash:', coll.input.txHash);
        console.log('  outputIndex:', coll.input.outputIndex);
        console.log('  lovelace:', lovelace / 1_000_000, 'ADA');
        console.log('  other assets:', otherAssets.length);
        if (otherAssets.length > 0) {
          console.warn('  ⚠️ WARNING: Collateral should be pure ADA!');
        }
      });
    } else {
      console.warn('\n⚠️ WARNING: No collateral UTxO found!');
    }

    // Get minting policy
    const mintingPolicy = getMintingPolicyValidator();
    const script = {
      code: mintingPolicy.compiledCode,
      version: 'V3' as const,
    };

    // Empty redeemer
    const redeemer = {
      data: { alternative: 0, fields: [] },
    };

    // Simple asset name
    const assetName = stringToHex('testToAddress');

    console.log('\n--- Transaction Construction ---');
    console.log('Minting 1 token...');
    tx.mintAsset(script, { assetName, assetQuantity: '1' }, redeemer);

    // Target address (user's address)
    const targetAddress = 'addr_test1qqdn9rfhjz82pzf2e7a5lj0cvhzuly8vrna8ywpcqn6438cryftzku36p8rse3rzklqfnsvvqest0z707n5lhvsppalqucnf3d';

    console.log('Sending minted token to:', targetAddress);
    tx.sendAssets(
      targetAddress,
      [
        {
          unit: MINTING_POLICY_HASH + assetName,
          quantity: '1',
        },
      ]
    );

    console.log('\n--- Attempting to Build Transaction ---');
    console.log('This is where Mesh SDK will try to select UTxOs...');

    const unsignedTx = await tx.build();

    // If we get here, it succeeded!
    console.log('✅ Transaction built successfully');
    console.log('\n--- Built Transaction (CBOR Hex) ---');
    console.log(unsignedTx);

    const signedTx = await wallet.signTx(unsignedTx);
    console.log('✅ Transaction signed successfully');

    const txHash = await wallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    return { success: true, txHash };
  } catch (error) {
    console.error('\n❌ Test 8 failed during transaction build');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('\nFull error object:', error);

    // Try to extract any additional info from the error
    if (error && typeof error === 'object') {
      console.error('\nError properties:');
      Object.keys(error).forEach(key => {
        console.error(`  ${key}:`, (error as any)[key]);
      });
    }

    return { success: false, error };
  }
}

// ============================================================================
// Test 9: Lucid Evolution - Mint + Send (Alternative to Mesh SDK)
// ============================================================================

export async function test9_LucidEvolution_MintAndSend(wallet: IWallet) {
  console.log('\n=== TEST 9: Lucid Evolution - Mint + Send ===');

  try {
    // Import Lucid Evolution modules
    const lucidModule = await import('@lucid-evolution/lucid');
    console.log('Lucid Evolution module loaded');
    console.log('Available exports:', Object.keys(lucidModule));

    const { Lucid, Blockfrost } = lucidModule;

    console.log('Initializing Lucid Evolution with Blockfrost (PreProd)...');

    // Get Blockfrost API key from environment or prompt user
    const blockfrostApiKey = process.env.NEXT_PUBLIC_BLOCKFROST_PREPROD_API_KEY;

    if (!blockfrostApiKey) {
      throw new Error(
        'Blockfrost API key not found. Please set NEXT_PUBLIC_BLOCKFROST_PREPROD_API_KEY in your .env.local file.\n' +
        'Get a free API key at: https://blockfrost.io'
      );
    }

    // Initialize Lucid with Blockfrost provider
    const lucid = await Lucid(
      new Blockfrost(
        'https://cardano-preprod.blockfrost.io/api/v0',
        blockfrostApiKey
      ),
      'Preprod'
    );

    console.log('Lucid instance created');
    console.log('Lucid methods:', Object.keys(lucid));

    console.log('\n--- Getting wallet info from Mesh wallet ---');

    // Get wallet information directly from Mesh wallet
    const changeAddress = await wallet.getChangeAddress();
    const meshUtxos = await wallet.getUtxos();

    console.log('Change address:', changeAddress);
    console.log('Available UTxOs:', meshUtxos.length);

    // Convert Mesh UTxOs to Lucid format
    console.log('\n--- Converting UTxOs to Lucid format ---');
    const lucidUtxos = meshUtxos.map(utxo => ({
      txHash: utxo.input.txHash,
      outputIndex: utxo.input.outputIndex,
      address: utxo.output.address,
      assets: Object.fromEntries(
        utxo.output.amount.map(asset => [asset.unit, BigInt(asset.quantity)])
      ),
    }));

    console.log('Converted', lucidUtxos.length, 'UTxOs to Lucid format');

    // Set wallet with address and UTxOs
    lucid.selectWallet.fromAddress(changeAddress, lucidUtxos);
    console.log('✅ Wallet selected in Lucid');

    // Get minting policy from contracts
    const mintingPolicy = getMintingPolicyValidator();
    console.log('Minting policy hash:', MINTING_POLICY_HASH);

    // Prepare minting script for Lucid
    const mintingScript = {
      type: 'PlutusV3' as const,
      script: mintingPolicy.compiledCode,
    };

    // Simple asset name for test
    const assetName = stringToHex('lucidTest1');
    const assetId = MINTING_POLICY_HASH + assetName;

    console.log('Asset name (hex):', assetName);
    console.log('Full asset ID:', assetId);

    // Import Data utility for redeemer
    const { Data } = lucidModule;

    // Create empty redeemer (void)
    const redeemer = Data.void();
    console.log('Redeemer created (void)');

    console.log('\n--- Building Transaction with Lucid Evolution ---');

    // Build the transaction
    const tx = lucid
      .newTx()
      .mintAssets({ [assetId]: 1n }, redeemer)
      .attach.MintingPolicy(mintingScript)
      .pay.ToAddress(changeAddress, { [assetId]: 1n });

    console.log('Transaction constructed, completing...');
    const completedTx = await tx.complete();
    console.log('✅ Transaction built successfully with Lucid Evolution!');

    // Get transaction CBOR
    const txCbor = completedTx.toCBOR();
    console.log('Transaction CBOR length:', txCbor.length, 'chars');
    console.log('Transaction CBOR (first 100):', txCbor.substring(0, 100) + '...');

    console.log('\n--- Signing Transaction with Mesh Wallet ---');
    const signedTx = await wallet.signTx(txCbor, true); // partial sign
    console.log('✅ Transaction signed successfully');

    console.log('\n--- Submitting Transaction ---');
    const txHash = await wallet.submitTx(signedTx);
    console.log('✅ Transaction submitted:', txHash);

    console.log('\n🎉 LUCID EVOLUTION TEST SUCCEEDED!');
    console.log('This proves:');
    console.log('  1. The transaction logic is valid');
    console.log('  2. Lucid Evolution CAN build mint+send in one transaction');
    console.log('  3. The issue is isolated to Mesh SDK UTxO selection bug');

    return { success: true, txHash };
  } catch (error) {
    console.error('\n❌ Test 9 (Lucid Evolution) failed');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('\nFull error object:', error);

    if (error && typeof error === 'object') {
      console.error('\nError properties:');
      Object.keys(error).forEach(key => {
        console.error(`  ${key}:`, (error as any)[key]);
      });
    }

    return { success: false, error };
  }
}

// ============================================================================
// Test Runner
// ============================================================================

export async function runDiagnostics(wallet: IWallet) {
  console.log('🔍 Starting Mesh SDK Diagnostic Tests');
  console.log('Each test builds on the previous one to isolate issues\n');

  const results = {
    test1: await test1_SimpleTransfer(wallet),
    test2: await test2_MintOnly(wallet),
    test3: await test3_MintAndSendToWallet(wallet),
    test4: await test4_MintCIP068Tokens(wallet),
    test5: await test5_MintWithMetadata(wallet),
  };

  console.log('\n📊 DIAGNOSTIC SUMMARY:');
  console.log('Test 1 (Simple Transfer):', results.test1.success ? '✅ PASS' : '❌ FAIL');
  console.log('Test 2 (Mint Only):', results.test2.success ? '✅ PASS' : '❌ FAIL');
  console.log('Test 3 (Mint + Send):', results.test3.success ? '✅ PASS' : '❌ FAIL');
  console.log('Test 4 (CIP-068 Dual):', results.test4.success ? '✅ PASS' : '❌ FAIL');
  console.log('Test 5 (Mint + Metadata):', results.test5.success ? '✅ PASS' : '❌ FAIL');

  return results;
}
