/**
 * PACT Token Query Library
 *
 * Queries user's wallet for PACT membership token
 * Used for token-gating blockVotePact claims
 */

import type { BrowserWallet } from '@meshsdk/core';

// PACT Membership NFT Script Hash
// This is the compiled validator hash from pact_membership.ak
export const PACT_SCRIPT_HASH = "41d4a7889e03e582859d39be04f276b1453d0e38b6c0c81b75b5a4d5";

// NOTE: PACT uses a parameterized minting policy (parameterized by UTxO reference)
// The actual policy ID will be different for each UTxO used
// For detection purposes, we'll need to track minted PACT tokens by their asset names
// (which will be hash of owner address)
export const PACT_POLICY_ID = PACT_SCRIPT_HASH;

/**
 * PACT token information
 */
export interface PactTokenInfo {
  policyId: string;
  assetName: string;
  unit: string; // policyId + assetName
  quantity: number;
  txHash: string; // Where it was minted
}

/**
 * Generate expected PACT token name for a given address
 * Uses blake2b-256 hash to match the minting logic
 */
function generatePactTokenName(userAddress: string): string {
  const { blake2b } = require('blakejs');
  const addressBytes = Buffer.from(userAddress, 'utf8');
  const hash = blake2b(addressBytes, null, 32);
  return Buffer.from(hash).toString('hex');
}

/**
 * Check if user has PACT token in their wallet
 *
 * PACT uses parameterized minting (unique policy ID per UTxO consumed)
 * So we detect by asset name (Blake2b-256 hash of user address)
 */
export async function hasPactToken(
  wallet: any,
  userAddress?: string
): Promise<boolean> {
  try {
    console.log('Checking wallet for PACT token...');

    // Get user address if not provided
    if (!userAddress) {
      userAddress = await wallet.getChangeAddress();
    }

    if (!userAddress) {
      console.error('Could not retrieve user address');
      return false;
    }

    // Generate expected token name
    const expectedTokenName = generatePactTokenName(userAddress);
    console.log('Expected PACT token name:', expectedTokenName);

    const utxos = await wallet.getUtxos();

    // Check if any asset has the matching token name
    const hasPact = utxos.some((utxo: any) =>
      utxo.output.amount.some((asset: any) => {
        // Extract token name from unit (last 64 chars for hex token name)
        const assetUnit = asset.unit;
        if (assetUnit === 'lovelace') return false;

        // Policy ID is first 56 chars, token name is the rest
        const tokenName = assetUnit.substring(56);
        return tokenName === expectedTokenName;
      })
    );

    console.log('Has PACT token:', hasPact);
    return hasPact;
  } catch (error) {
    console.error('Failed to check for PACT token:', error);
    return false;
  }
}

/**
 * Get PACT token details from wallet
 * Detects by token name (Blake2b hash of address)
 */
export async function getPactTokenInfo(
  wallet: any,
  userAddress?: string
): Promise<PactTokenInfo | null> {
  try {
    console.log('Getting PACT token info...');

    // Get user address if not provided
    if (!userAddress) {
      userAddress = await wallet.getChangeAddress();
    }

    if (!userAddress) {
      console.error('Could not retrieve user address');
      return null;
    }

    // Generate expected token name
    const expectedTokenName = generatePactTokenName(userAddress);
    const utxos = await wallet.getUtxos();

    for (const utxo of utxos as any[]) {
      for (const asset of utxo.output.amount as any[]) {
        if (asset.unit === 'lovelace') continue;

        // Extract policy ID and token name
        const policyId = asset.unit.substring(0, 56);
        const tokenName = asset.unit.substring(56);

        if (tokenName === expectedTokenName) {
          return {
            policyId,
            assetName: tokenName,
            unit: asset.unit,
            quantity: parseInt(asset.quantity),
            txHash: utxo.input.txHash,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get PACT token info:', error);
    return null;
  }
}
