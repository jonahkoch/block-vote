/**
 * Query Governance PACTs from Blockchain
 *
 * Fetches real governance PACTs by querying UTxOs at the Metadata Validator address
 */

import { METADATA_VALIDATOR_HASH } from './contracts';
import type { GovernanceAction, GovernanceActionStatus } from '@/components/GovernanceActionList';

const BLOCKFROST_API_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_PREVIEW_API_KEY;
const BLOCKFROST_URL = 'https://cardano-preview.blockfrost.io/api/v0';

/**
 * Convert script hash to Bech32 address
 * Uses the same method as transactions-lucid.ts
 */
async function getMetadataValidatorAddress(): Promise<string> {
  // Use the existing helper from lucid-provider
  const { initializeLucid, getValidatorAddress } = await import('./lucid-provider');

  // Initialize Lucid
  const lucid = await initializeLucid();

  // Get validator address using the helper
  const address = getValidatorAddress(lucid, METADATA_VALIDATOR_HASH);

  return address;
}

/**
 * Query all UTxOs at the Metadata Validator address
 */
export async function queryMetadataValidatorUTxOs() {
  if (!BLOCKFROST_API_KEY) {
    throw new Error('BLOCKFROST_API_KEY not configured');
  }

  const metadataAddress = await getMetadataValidatorAddress();
  console.log('Querying Metadata Validator address:', metadataAddress);

  try {
    const response = await fetch(`${BLOCKFROST_URL}/addresses/${metadataAddress}/utxos`, {
      headers: {
        'project_id': BLOCKFROST_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
    }

    const utxos = await response.json();
    return utxos;
  } catch (error) {
    console.error('Failed to query Metadata Validator UTxOs:', error);
    throw error;
  }
}

/**
 * Convert hex string to UTF-8 string
 */
function hexToString(hex: string): string {
  try {
    return Buffer.from(hex, 'hex').toString('utf8');
  } catch (error) {
    console.error('Failed to decode hex string:', hex);
    return '';
  }
}

/**
 * Decode datum from UTxO to get governance pact data
 *
 * The datum structure matches GovernancePactDatum:
 * Constructor 0 with 11 fields:
 * 0: title (ByteArray)
 * 1: description (ByteArray)
 * 2: cardano_action_id (ByteArray)
 * 3: cardano_action_type (ByteArray)
 * 4: voting_deadline (Int)
 * 5: total_members (Int)
 * 6: required_votes (Int)
 * 7: policy_id (ByteArray)
 * 8: asset_name (ByteArray)
 * 9: metadata_validator (Address)
 * 10: distribution_validator (Address)
 */
async function decodePactDatum(inlineDatum: string | null) {
  if (!inlineDatum) {
    console.warn('No inline datum found');
    return null;
  }

  try {
    // Import Lucid's Data decoder
    const { Data } = await import('@lucid-evolution/lucid');

    // Decode CBOR to Plutus Data structure
    const decoded = Data.from(inlineDatum);

    // Plutus Data is returned as a Constr object
    // Check if it's the expected constructor (0 for GovernancePactDatum)
    if (typeof decoded !== 'object' || !('index' in decoded) || decoded.index !== 0) {
      console.error('Unexpected datum structure:', decoded);
      return null;
    }

    // Extract fields from constructor
    const fields = (decoded as any).fields;

    if (!Array.isArray(fields) || fields.length !== 11) {
      console.error(`Expected 11 fields, got ${fields?.length}`);
      return null;
    }

    // Decode each field according to the schema
    const [
      titleHex,
      descriptionHex,
      cardanoActionIdHex,
      cardanoActionTypeHex,
      votingDeadline,
      totalMembers,
      requiredVotes,
      policyId,
      assetNameHex,
      metadataValidator,
      distributionValidator,
    ] = fields;

    return {
      title: hexToString(titleHex),
      description: hexToString(descriptionHex),
      cardanoActionId: hexToString(cardanoActionIdHex),
      cardanoActionType: hexToString(cardanoActionTypeHex),
      votingDeadline: Number(votingDeadline),
      totalMembers: Number(totalMembers),
      requiredVotes: Number(requiredVotes),
      policyId: policyId,
      assetName: assetNameHex,  // Keep as hex - this is the base name WITHOUT CIP-068 label
      // Skip address decoding for now, we don't need them for display
    };
  } catch (error) {
    console.error('Failed to decode pact datum:', error);
    return null;
  }
}

/**
 * Get transaction timestamp from Blockfrost
 */
async function getTransactionTimestamp(txHash: string): Promise<number> {
  if (!BLOCKFROST_API_KEY) {
    return 0;
  }

  try {
    const response = await fetch(`${BLOCKFROST_URL}/txs/${txHash}`, {
      headers: {
        'project_id': BLOCKFROST_API_KEY,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch tx timestamp for ${txHash}: ${response.status}`);
      return 0;
    }

    const txData = await response.json();
    // block_time is in seconds, convert to milliseconds
    return txData.block_time * 1000;
  } catch (error) {
    console.error('Failed to fetch transaction timestamp:', error);
    return 0;
  }
}

/**
 * Calculate governance action status based on votes and deadline
 */
function calculatePactStatus(
  currentVotes: number,
  requiredVotes: number,
  votingDeadline: number
): GovernanceActionStatus {
  const now = Date.now();
  const isPastDeadline = now > votingDeadline;

  if (!isPastDeadline) {
    return 'active';
  }

  // Past deadline
  if (currentVotes >= requiredVotes) {
    return 'approved';
  } else {
    return 'non-binding';
  }
}

/**
 * Query all governance PACTs from the blockchain
 */
export async function queryGovernancePacts(): Promise<GovernanceAction[]> {
  try {
    console.log('Querying governance PACTs from blockchain...');

    // Query UTxOs at metadata validator
    const utxos = await queryMetadataValidatorUTxOs();
    console.log(`Found ${utxos.length} UTxOs at Metadata Validator`);

    if (utxos.length === 0) {
      return [];
    }

    // Decode each UTxO's datum to get pact data
    const pacts: GovernanceAction[] = [];

    for (const utxo of utxos) {
      try {
        // Extract pact data from datum
        const pactData = await decodePactDatum(utxo.inline_datum);

        if (!pactData) {
          console.warn('Failed to decode pact datum for UTxO:', utxo.tx_hash);
          continue;
        }

        console.log('Decoded pact:', {
          title: pactData.title,
          deadline: new Date(pactData.votingDeadline).toLocaleString(),
        });

        // Get transaction timestamp
        const createdAt = await getTransactionTimestamp(utxo.tx_hash);

        // Query voting validator for current vote count
        const USER_TOKEN_LABEL = '001bc280';
        const userTokenName = USER_TOKEN_LABEL + pactData.assetName;

        let currentVotes = 0;
        try {
          const voteResults = await queryVotesForPact(pactData.policyId, userTokenName);
          currentVotes = voteResults.totalVotes;
          console.log(`Vote count for pact: ${currentVotes} (${voteResults.yesVotes} Yes, ${voteResults.noVotes} No)`);
        } catch (err) {
          console.warn('Failed to query votes for pact:', err);
          // Continue with currentVotes = 0
        }

        // Build governance action object
        // refTokenUnit = policyId + referenceTokenLabel (000643b0) + baseAssetName
        const REFERENCE_TOKEN_LABEL = '000643b0';
        const refTokenUnit = `${pactData.policyId}${REFERENCE_TOKEN_LABEL}${pactData.assetName}`;

        const action: GovernanceAction = {
          id: `${utxo.tx_hash}#${utxo.output_index}`,
          title: pactData.title,
          description: pactData.description,
          createdAt,
          votingDeadline: pactData.votingDeadline,
          totalMembers: pactData.totalMembers,
          requiredVotes: pactData.requiredVotes,
          currentVotes,
          status: calculatePactStatus(
            currentVotes,
            pactData.requiredVotes,
            pactData.votingDeadline
          ),
          refTokenUnit,
        };

        pacts.push(action);
      } catch (error) {
        console.error('Error processing UTxO:', utxo.tx_hash, error);
        continue;
      }
    }

    console.log(`Successfully decoded ${pacts.length} of ${utxos.length} PACTs`);

    // Sort by creation date, most recent first
    pacts.sort((a, b) => b.createdAt - a.createdAt);

    return pacts;
  } catch (error) {
    console.error('Failed to query governance PACTs:', error);
    throw error;
  }
}

/**
 * Check if Blockfrost is configured
 */
export function isBlockfrostConfigured(): boolean {
  return !!BLOCKFROST_API_KEY;
}

// ============================================================================
// Distribution Validator Queries
// ============================================================================

/**
 * Get Distribution Validator address
 */
async function getDistributionValidatorAddress(): Promise<string> {
  const { initializeLucid, getValidatorAddress } = await import('./lucid-provider');
  const { DISTRIBUTION_VALIDATOR_HASH } = await import('./contracts');

  const lucid = await initializeLucid();
  const address = getValidatorAddress(lucid, DISTRIBUTION_VALIDATOR_HASH);

  return address;
}

/**
 * Query Distribution Validator UTxOs for a specific governance pact
 * @param policyId - The policy ID of the governance pact
 * @param userTokenName - The user token name (with CIP-068 label 222)
 * @returns Distribution UTxO containing the tokens, or null if not found
 */
export async function queryDistributionUtxoForPact(
  policyId: string,
  userTokenName: string
): Promise<{
  txHash: string;
  outputIndex: number;
  tokenCount: number;
  datum: any;
} | null> {
  if (!BLOCKFROST_API_KEY) {
    throw new Error('BLOCKFROST_API_KEY not configured');
  }

  try {
    const distributionAddress = await getDistributionValidatorAddress();
    console.log('Querying Distribution Validator address:', distributionAddress);

    // Query all UTxOs at the distribution validator
    const response = await fetch(`${BLOCKFROST_URL}/addresses/${distributionAddress}/utxos`, {
      headers: {
        'project_id': BLOCKFROST_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
    }

    const utxos = await response.json();
    console.log(`Found ${utxos.length} UTxOs at Distribution Validator`);

    // Find the UTxO containing tokens for this governance pact
    const assetUnit = `${policyId}${userTokenName}`;

    for (const utxo of utxos) {
      // Check if this UTxO contains the target tokens
      const tokenAmount = utxo.amount.find((a: any) => a.unit === assetUnit);

      if (tokenAmount && parseInt(tokenAmount.quantity) > 0) {
        console.log(`Found Distribution UTxO with ${tokenAmount.quantity} tokens`);

        return {
          txHash: utxo.tx_hash,
          outputIndex: utxo.output_index,
          tokenCount: parseInt(tokenAmount.quantity),
          datum: utxo.inline_datum,
        };
      }
    }

    console.log('No Distribution UTxO found for this pact');
    return null;
  } catch (error) {
    console.error('Failed to query Distribution Validator UTxOs:', error);
    throw error;
  }
}

/**
 * Decode Distribution Datum from CBOR
 * @param inlineDatum - CBOR-encoded datum
 * @returns Decoded distribution datum
 */
export async function decodeDistributionDatum(inlineDatum: string | null) {
  if (!inlineDatum) {
    console.warn('No inline datum found');
    return null;
  }

  try {
    const { Data } = await import('@lucid-evolution/lucid');

    // Decode CBOR to Plutus Data structure
    const decoded = Data.from(inlineDatum);

    // Check if it's the expected constructor (0 for DistributionDatum)
    if (typeof decoded !== 'object' || !('index' in decoded) || decoded.index !== 0) {
      console.error('Unexpected datum structure:', decoded);
      return null;
    }

    // Extract fields from constructor
    const fields = (decoded as any).fields;

    if (!Array.isArray(fields) || fields.length !== 4) {
      console.error(`Expected 4 fields, got ${fields?.length}`);
      return null;
    }

    const [qualifiedMembers, policyId, userTokenName, totalTokens] = fields;

    return {
      qualifiedMembers, // List of credentials (kept as-is for now)
      policyId,
      userTokenName,
      totalTokens: Number(totalTokens),
    };
  } catch (error) {
    console.error('Failed to decode distribution datum:', error);
    return null;
  }
}

// ============================================================================
// Voting Validator Queries
// ============================================================================

/**
 * Get Voting Validator address
 */
async function getVotingValidatorAddress(): Promise<string> {
  const { initializeLucid, getValidatorAddress } = await import('./lucid-provider');
  const { VOTING_VALIDATOR_HASH } = await import('./contracts');

  const lucid = await initializeLucid();
  const address = getValidatorAddress(lucid, VOTING_VALIDATOR_HASH);

  return address;
}

/**
 * Decode CastVote Datum from CBOR
 *
 * The datum structure matches CastVote redeemer:
 * - Constructor 0 = Yes vote
 * - Constructor 1 = No vote
 *
 * @param inlineDatum - CBOR-encoded datum
 * @returns 'Yes' | 'No' | null
 */
export async function decodeCastVoteDatum(inlineDatum: string | null): Promise<'Yes' | 'No' | null> {
  if (!inlineDatum) {
    console.warn('No inline datum found');
    return null;
  }

  try {
    const { Data } = await import('@lucid-evolution/lucid');

    // Decode CBOR to Plutus Data structure
    const decoded = Data.from(inlineDatum);

    // Check if it's a constructor
    if (typeof decoded !== 'object' || !('index' in decoded)) {
      console.error('Unexpected datum structure:', decoded);
      return null;
    }

    // Constructor 0 = Yes, Constructor 1 = No
    if (decoded.index === 0) {
      return 'Yes';
    } else if (decoded.index === 1) {
      return 'No';
    } else {
      console.error('Unexpected vote constructor index:', decoded.index);
      return null;
    }
  } catch (error) {
    console.error('Failed to decode vote datum:', error);
    return null;
  }
}

/**
 * Query votes for a specific governance pact
 *
 * @param policyId - The policy ID of the governance pact tokens
 * @param userTokenName - The user token name (with CIP-068 label 222)
 * @returns Vote breakdown with Yes/No counts
 */
export async function queryVotesForPact(
  policyId: string,
  userTokenName: string
): Promise<{
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  votes: Array<{ txHash: string; outputIndex: number; vote: 'Yes' | 'No' }>;
}> {
  if (!BLOCKFROST_API_KEY) {
    throw new Error('BLOCKFROST_API_KEY not configured');
  }

  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   QUERYING VOTES FOR PACT              ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('Policy ID:', policyId);
    console.log('User Token Name:', userTokenName);

    const votingValidatorAddress = await getVotingValidatorAddress();
    console.log('Voting Validator address:', votingValidatorAddress);

    // Query all UTxOs at the voting validator
    const response = await fetch(`${BLOCKFROST_URL}/addresses/${votingValidatorAddress}/utxos`, {
      headers: {
        'project_id': BLOCKFROST_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
    }

    const utxos = await response.json();
    console.log(`Found ${utxos.length} total UTxOs at Voting Validator`);

    // Filter UTxOs that contain this governance pact's tokens
    const assetUnit = `${policyId}${userTokenName}`;
    console.log('Looking for asset unit:', assetUnit);

    const voteUtxos = utxos.filter((utxo: any) => {
      const hasToken = utxo.amount.some((a: any) => a.unit === assetUnit && parseInt(a.quantity) > 0);
      return hasToken;
    });

    console.log(`Found ${voteUtxos.length} vote UTxOs for this pact`);

    // Decode each vote datum
    let yesVotes = 0;
    let noVotes = 0;
    const votes: Array<{ txHash: string; outputIndex: number; vote: 'Yes' | 'No' }> = [];

    for (const utxo of voteUtxos) {
      const voteChoice = await decodeCastVoteDatum(utxo.inline_datum);

      if (voteChoice) {
        votes.push({
          txHash: utxo.tx_hash,
          outputIndex: utxo.output_index,
          vote: voteChoice,
        });

        if (voteChoice === 'Yes') {
          yesVotes++;
        } else {
          noVotes++;
        }

        console.log(`  • ${voteChoice} vote (${utxo.tx_hash})`);
      } else {
        console.warn(`  ⚠ Could not decode vote for UTxO: ${utxo.tx_hash}`);
      }
    }

    const totalVotes = yesVotes + noVotes;

    console.log('\n📊 Vote Breakdown:');
    console.log(`  Yes: ${yesVotes}`);
    console.log(`  No:  ${noVotes}`);
    console.log(`  Total: ${totalVotes}`);

    return {
      yesVotes,
      noVotes,
      totalVotes,
      votes,
    };
  } catch (error) {
    console.error('Failed to query votes for pact:', error);
    throw error;
  }
}
