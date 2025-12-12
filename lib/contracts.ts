/**
 * BlockVote Smart Contract Integration
 *
 * This file contains the Plutus validator definitions and helper functions
 * for interacting with the blockVote smart contracts on Cardano.
 */

// Import plutus.json (copied from block-vote-contracts)
// Original: /Users/joko/Development/coLab/block-vote-contracts/plutus.json
// Note: Run `cp ../block-vote-contracts/plutus.json lib/plutus.json` after rebuilding contracts
import plutusBlueprint from './plutus.json';

// ============================================================================
// Script Hashes and Validators
// ============================================================================

/**
 * Get the minting policy validator from plutus.json
 */
export function getMintingPolicyValidator() {
  const validator = plutusBlueprint.validators.find(
    (v) => v.title === 'minting_policy.minting_policy.mint'
  );

  if (!validator) {
    throw new Error('Minting policy validator not found in plutus.json');
  }

  return validator;
}

/**
 * Get the metadata validator from plutus.json
 */
export function getMetadataValidator() {
  const validator = plutusBlueprint.validators.find(
    (v) => v.title === 'metadata_validator.metadata_validator.spend'
  );

  if (!validator) {
    throw new Error('Metadata validator not found in plutus.json');
  }

  return validator;
}

/**
 * Get the distribution validator from plutus.json
 */
export function getDistributionValidator() {
  const validator = plutusBlueprint.validators.find(
    (v) => v.title === 'distribution_validator.distribution_validator.spend'
  );

  if (!validator) {
    throw new Error('Distribution validator not found in plutus.json');
  }

  return validator;
}

/**
 * Get the voting validator from plutus.json
 */
export function getVotingValidator() {
  const validator = plutusBlueprint.validators.find(
    (v) => v.title === 'voting_validator.voting_validator.mint'
  );

  if (!validator) {
    throw new Error('Voting validator not found in plutus.json');
  }

  return validator;
}

// ============================================================================
// Script Hashes (Policy IDs)
// ============================================================================

/**
 * Minting policy script hash (this is the Policy ID for CIP-068 tokens)
 */
export const MINTING_POLICY_HASH = getMintingPolicyValidator().hash;

/**
 * Metadata validator script hash
 */
export const METADATA_VALIDATOR_HASH = getMetadataValidator().hash;

/**
 * Distribution validator script hash
 */
export const DISTRIBUTION_VALIDATOR_HASH = getDistributionValidator().hash;

/**
 * Voting validator script hash
 */
export const VOTING_VALIDATOR_HASH = getVotingValidator().hash;

// ============================================================================
// Script Addresses
// ============================================================================

/**
 * Metadata validator script object (for Mesh SDK)
 * Contains both code and hash for script address resolution
 */
export const METADATA_VALIDATOR_SCRIPT = {
  code: getMetadataValidator().compiledCode,
  version: 'V3' as const,
};

/**
 * Distribution validator script object (for Mesh SDK)
 */
export const DISTRIBUTION_VALIDATOR_SCRIPT = {
  code: getDistributionValidator().compiledCode,
  version: 'V3' as const,
};

/**
 * Voting validator script object (for Lucid SDK)
 */
export const VOTING_VALIDATOR_SCRIPT = {
  code: getVotingValidator().compiledCode,
  version: 'V3' as const,
};

// ============================================================================
// CIP-068 Token Labels
// ============================================================================

/**
 * CIP-068 Reference Token Label (100)
 * Prefix: 0x000643b0
 */
export const REFERENCE_TOKEN_LABEL = '000643b0';

/**
 * CIP-068 User Token Label (222)
 * Prefix: 0x001bc280
 */
export const USER_TOKEN_LABEL = '001bc280';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert string to hex
 */
export function stringToHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex');
}

/**
 * Convert hex to string
 */
export function hexToString(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

/**
 * Create CIP-068 reference token asset name
 * @param baseName - Base name without label
 * @returns Full asset name with CIP-068 label 100 prefix
 */
export function makeReferenceTokenName(baseName: string): string {
  return REFERENCE_TOKEN_LABEL + stringToHex(baseName);
}

/**
 * Create CIP-068 user token asset name
 * @param baseName - Base name without label
 * @returns Full asset name with CIP-068 label 222 prefix
 */
export function makeUserTokenName(baseName: string): string {
  return USER_TOKEN_LABEL + stringToHex(baseName);
}

/**
 * Generate unique asset name for a governance pact
 * Uses timestamp to ensure uniqueness
 */
export function generatePactAssetName(): string {
  const timestamp = Date.now();
  return `blockVotePact${timestamp}`;
}

/**
 * Calculate simple majority (N/2 + 1)
 */
export function calculateRequiredVotes(totalMembers: number): number {
  return Math.floor(totalMembers / 2) + 1;
}

/**
 * Calculate blockVote voting deadline (3 epochs before Cardano expiry)
 * @param cardanoExpiryEpoch - Cardano governance action expiry epoch
 * @returns POSIX timestamp in milliseconds
 */
export function calculateBlockVoteDeadline(cardanoExpiryEpoch: number): number {
  // Mainnet: 1 epoch = 5 days = 432,000 seconds
  // Preview testnet: 1 epoch = 30 minutes = 1,800 seconds

  // For Preview testnet (TODO: Switch based on network)
  const EPOCH_DURATION_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

  // Current epoch (approximate - should fetch from blockchain in production)
  const GENESIS_TIME = 1666656000000; // Preview testnet genesis (approximate)
  const currentTime = Date.now();
  const currentEpoch = Math.floor((currentTime - GENESIS_TIME) / EPOCH_DURATION_MS);

  // Calculate deadline: 3 epochs before Cardano expiry
  const deadlineEpoch = cardanoExpiryEpoch - 3;

  // Convert epoch to timestamp
  const deadlineTimestamp = GENESIS_TIME + (deadlineEpoch * EPOCH_DURATION_MS);

  return deadlineTimestamp;
}

// ============================================================================
// Export all validators for easy access
// ============================================================================

export const validators = {
  mintingPolicy: getMintingPolicyValidator(),
  metadata: getMetadataValidator(),
  distribution: getDistributionValidator(),
  voting: getVotingValidator(),
};

export const scriptHashes = {
  mintingPolicy: MINTING_POLICY_HASH,
  metadata: METADATA_VALIDATOR_HASH,
  distribution: DISTRIBUTION_VALIDATOR_HASH,
  voting: VOTING_VALIDATOR_HASH,
};
