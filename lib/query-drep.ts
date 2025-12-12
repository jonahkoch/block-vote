/**
 * DRep Query Library
 *
 * Queries Blockfrost API for DRep registration status and delegation information
 * Used for PACT token eligibility validation
 */

import type { BrowserWallet } from '@meshsdk/core';

const BLOCKFROST_API_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_PREVIEW_API_KEY;
const BLOCKFROST_URL = 'https://cardano-preview.blockfrost.io/api/v0';

// Thresholds for PACT token eligibility
export const DELEGATION_THRESHOLD = 13_000_000_000_000; // 13M ADA in lovelace
export const MIN_WALLET_BALANCE = 10_000_000; // 10 ADA in lovelace

/**
 * DRep account information from Blockfrost
 */
export interface DRepAccountInfo {
  stakeAddress: string;
  active: boolean;
  controlledAmount: number; // Delegation in lovelace
  drepId: string | null;
  poolId: string | null;
}

/**
 * PACT eligibility result
 */
export interface PactEligibility {
  isEligible: boolean;
  isDRep: boolean;
  delegationAmount: number; // In lovelace
  delegationAda: number; // In ADA for display
  passesDelegationThreshold: boolean;
  hasMinimumBalance: boolean;
  walletBalance: number; // In lovelace
  walletBalanceAda: number; // In ADA for display
  drepId?: string; // DRep ID (new format)
  drepIdCip105?: string; // Legacy CIP-105 format
  reason?: string; // Why ineligible
}

/**
 * Get stake address from connected wallet
 */
export async function getStakeAddress(wallet: any): Promise<string | null> {
  try {
    console.log('Getting stake address from wallet...');
    const rewardAddresses = await wallet.getRewardAddresses();

    if (!rewardAddresses || rewardAddresses.length === 0) {
      console.warn('No reward addresses found in wallet');
      return null;
    }

    const stakeAddress = rewardAddresses[0];
    console.log('Stake address:', stakeAddress);
    return stakeAddress;
  } catch (error) {
    console.error('Failed to get stake address:', error);
    return null;
  }
}

/**
 * Get DRep account information from Blockfrost
 */
export async function getDRepAccountInfo(stakeAddress: string): Promise<DRepAccountInfo | null> {
  if (!BLOCKFROST_API_KEY) {
    console.error('Blockfrost API key not configured');
    return null;
  }

  try {
    console.log('Querying Blockfrost for DRep info:', stakeAddress);

    const response = await fetch(`${BLOCKFROST_URL}/accounts/${stakeAddress}`, {
      headers: {
        'project_id': BLOCKFROST_API_KEY,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('Stake address not found (wallet may not be registered)');
        return null;
      }
      throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('DRep account data:', {
      active: data.active,
      drepId: data.drep_id,
      controlledAmount: data.controlled_amount,
      poolId: data.pool_id,
    });

    return {
      stakeAddress: data.stake_address,
      active: data.active,
      controlledAmount: parseInt(data.controlled_amount || '0'),
      drepId: data.drep_id || null,
      poolId: data.pool_id || null,
    };
  } catch (error) {
    console.error('Failed to query DRep account info:', error);
    return null;
  }
}

/**
 * Get wallet balance in lovelace
 */
export async function getWalletBalance(wallet: any): Promise<number> {
  try {
    console.log('Getting wallet balance...');

    // Add timeout protection like WalletDrawer
    const utxosPromise = wallet.getUtxos();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    );

    const utxos = await Promise.race([utxosPromise, timeoutPromise]) as any[];
    console.log('UTxOs received:', utxos.length);

    let totalLovelace = 0;
    utxos.forEach(utxo => {
      utxo.output.amount.forEach(asset => {
        if (asset.unit === 'lovelace') {
          totalLovelace += parseInt(asset.quantity);
        }
      });
    });

    console.log('Wallet balance:', totalLovelace, 'lovelace =', totalLovelace / 1_000_000, 'ADA');
    return totalLovelace;
  } catch (error) {
    console.error('Failed to get wallet balance:', error);
    return 0;
  }
}

/**
 * Check if wallet is eligible for PACT token
 *
 * Requirements:
 * 1. Must be a registered DRep (drep_id exists)
 * 2. Delegation must be < 13M ADA
 * 3. Wallet balance must be >= 10 ADA
 */
export async function checkPactEligibility(wallet: any): Promise<PactEligibility> {
  // Get stake address
  const stakeAddress = await getStakeAddress(wallet);
  if (!stakeAddress) {
    return {
      isEligible: false,
      isDRep: false,
      delegationAmount: 0,
      delegationAda: 0,
      passesDelegationThreshold: false,
      hasMinimumBalance: false,
      walletBalance: 0,
      walletBalanceAda: 0,
      reason: 'Could not retrieve stake address from wallet',
    };
  }

  // Get DRep account info
  const accountInfo = await getDRepAccountInfo(stakeAddress);
  if (!accountInfo) {
    return {
      isEligible: false,
      isDRep: false,
      delegationAmount: 0,
      delegationAda: 0,
      passesDelegationThreshold: false,
      hasMinimumBalance: false,
      walletBalance: 0,
      walletBalanceAda: 0,
      reason: 'Could not retrieve account information from blockchain',
    };
  }

  // Check if registered as DRep
  const isDRep = accountInfo.drepId !== null;
  if (!isDRep) {
    return {
      isEligible: false,
      isDRep: false,
      delegationAmount: accountInfo.controlledAmount,
      delegationAda: accountInfo.controlledAmount / 1_000_000,
      passesDelegationThreshold: false,
      hasMinimumBalance: false,
      walletBalance: 0,
      walletBalanceAda: 0,
      reason: 'Wallet is not registered as a DRep',
    };
  }

  // Check delegation threshold
  const passesDelegationThreshold = accountInfo.controlledAmount < DELEGATION_THRESHOLD;

  // Get wallet balance
  const walletBalance = await getWalletBalance(wallet);
  const hasMinimumBalance = walletBalance >= MIN_WALLET_BALANCE;

  // Determine eligibility
  const isEligible = isDRep && passesDelegationThreshold && hasMinimumBalance;

  let reason: string | undefined;
  if (!isEligible) {
    if (!passesDelegationThreshold) {
      reason = `Delegation (${(accountInfo.controlledAmount / 1_000_000).toFixed(2)} ADA) exceeds threshold of 13M ADA`;
    } else if (!hasMinimumBalance) {
      reason = `Wallet balance (${(walletBalance / 1_000_000).toFixed(2)} ADA) is below minimum of 10 ADA`;
    }
  }

  return {
    isEligible,
    isDRep,
    delegationAmount: accountInfo.controlledAmount,
    delegationAda: accountInfo.controlledAmount / 1_000_000,
    passesDelegationThreshold,
    hasMinimumBalance,
    walletBalance,
    walletBalanceAda: walletBalance / 1_000_000,
    drepId: accountInfo.drepId || undefined,
    drepIdCip105: accountInfo.drepId ? convertToCip105(accountInfo.drepId) : undefined,
    reason,
  };
}

/**
 * Convert DRep ID to CIP-105 format
 * CIP-105 uses drep1... bech32 encoding for legacy compatibility
 */
function convertToCip105(drepId: string): string {
  // If it already starts with drep1, it's already in CIP-105 format
  if (drepId.startsWith('drep1')) {
    return drepId;
  }

  // Otherwise, the Blockfrost API should already return it in the correct format
  // This is a placeholder - actual conversion would require bech32 encoding
  return drepId;
}

/**
 * Check if Blockfrost is configured
 */
export function isBlockfrostConfigured(): boolean {
  return !!BLOCKFROST_API_KEY;
}
