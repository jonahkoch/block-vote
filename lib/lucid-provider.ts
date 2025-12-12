/**
 * Lucid Evolution Provider
 *
 * Initializes and manages Lucid Evolution instance with Blockfrost
 */

import { Lucid, Blockfrost, type LucidEvolution, scriptHashToCredential, credentialToAddress } from '@lucid-evolution/lucid';
import type { IWallet } from '@meshsdk/core';

/**
 * Initialize Lucid Evolution with Blockfrost provider
 */
export async function initializeLucid(): Promise<LucidEvolution> {
  const blockfrostApiKey = process.env.NEXT_PUBLIC_BLOCKFROST_PREVIEW_API_KEY;

  if (!blockfrostApiKey) {
    throw new Error(
      'Blockfrost API key not found. Please set NEXT_PUBLIC_BLOCKFROST_PREVIEW_API_KEY in your .env.local file.\n' +
      'Get a free API key at: https://blockfrost.io'
    );
  }

  // Hardcoded to Preview network
  const lucid = await Lucid(
    new Blockfrost(
      'https://cardano-preview.blockfrost.io/api/v0',
      blockfrostApiKey
    ),
    'Preview'
  );

  return lucid;
}

/**
 * Convert Mesh wallet UTxOs to Lucid format
 */
export async function connectMeshWalletToLucid(
  lucid: LucidEvolution,
  meshWallet: IWallet
) {
  const address = await meshWallet.getChangeAddress();
  const meshUtxos = await meshWallet.getUtxos();

  // Convert Mesh UTxOs to Lucid format
  const lucidUtxos = meshUtxos.map(utxo => ({
    txHash: utxo.input.txHash,
    outputIndex: utxo.input.outputIndex,
    address: utxo.output.address,
    assets: Object.fromEntries(
      utxo.output.amount.map(asset => [asset.unit, BigInt(asset.quantity)])
    ),
  }));

  // Set wallet with address and UTxOs
  lucid.selectWallet.fromAddress(address, lucidUtxos);

  return lucid;
}

/**
 * Get validator address from script hash
 * Converts a script hash to a proper Bech32 address for the current network
 */
export function getValidatorAddress(lucid: LucidEvolution, scriptHash: string): string {
  // Get network
  const network = lucid.config().network;

  if (!network) {
    throw new Error('Network not configured in Lucid instance');
  }

  // Convert script hash to credential using Lucid's utility
  const credential = scriptHashToCredential(scriptHash);

  // Convert credential to address (no stake credential)
  const address = credentialToAddress(network, credential);

  return address;
}
