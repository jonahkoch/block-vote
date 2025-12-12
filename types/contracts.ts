/**
 * BlockVote Smart Contract Types
 *
 * TypeScript type definitions for Plutus validators
 * These match the Aiken data types in the validators
 */

// ============================================================================
// Cardano Native Types
// ============================================================================

export type PolicyId = string; // Hex-encoded policy ID
export type AssetName = string; // Hex-encoded asset name
export type TxHash = string; // Transaction hash
export type Address = string; // Bech32 address

/**
 * Credential (VerificationKey or Script)
 */
export interface Credential {
  type: 'VerificationKey' | 'Script';
  hash: string; // Verification key hash or script hash
}

/**
 * UTxO Reference (transaction hash + output index)
 */
export interface OutputReference {
  txHash: TxHash;
  outputIndex: number;
}

// ============================================================================
// Governance Pact Datum (Minting Policy & Metadata Validator)
// ============================================================================

/**
 * GovernancePactDatum - Stored at metadata validator with reference token
 *
 * This is the on-chain record of a governance pact.
 * It contains all metadata needed to track and validate voting.
 */
export interface GovernancePactDatum {
  /** Title of the governance pact */
  title: string;

  /** Description/abstract from Cardano governance action */
  description: string;

  /** Cardano governance action ID (txHash#index) */
  cardanoActionId: string;

  /** Cardano governance action type (InfoAction, TreasuryWithdrawals, etc) */
  cardanoActionType: string;

  /** POSIX timestamp when blockVote voting ends (milliseconds) */
  votingDeadline: number;

  /** Total number of qualified members */
  totalMembers: number;

  /** Required votes for binding result (simple majority: total_members/2 + 1) */
  requiredVotes: number;

  /** Policy ID of this minting policy (for identifying tokens) */
  policyId: PolicyId;

  /** Asset name (without CIP-068 label prefix) */
  assetName: string;

  /** Address of the metadata validator (where reference token is locked) */
  metadataValidator: Address;

  /** Address of the distribution validator (where user tokens go) */
  distributionValidator: Address;
}

// ============================================================================
// Distribution Datum
// ============================================================================

/**
 * DistributionDatum - Stored at distribution validator with user tokens
 *
 * Tracks which members can claim governance tokens.
 */
export interface DistributionDatum {
  /** List of qualified member credentials */
  qualifiedMembers: Credential[];

  /** Policy ID of the tokens being distributed */
  policyId: PolicyId;

  /** User token asset name (with CIP-068 label 222) */
  userTokenName: AssetName;

  /** Total number of tokens initially deposited */
  totalTokens: number;
}

// ============================================================================
// Redeemers
// ============================================================================

/**
 * MintRedeemer - For minting governance pact tokens
 */
export interface MintRedeemer {
  type: 'CreatePact';
  qualifiedMembers: Credential[];
  pactDatum: GovernancePactDatum;
}

/**
 * MetadataRedeemer - For spending reference token
 */
export interface MetadataRedeemer {
  type: 'UnlockAfterVoting';
}

/**
 * DistributionRedeemer - For claiming user token
 */
export interface DistributionRedeemer {
  type: 'ClaimToken';
}

/**
 * VotingRedeemer - For burning token (casting vote)
 */
export interface VotingRedeemer {
  type: 'CastVote';
  vote: 'Yes' | 'No';
}

// ============================================================================
// Transaction Builder Types
// ============================================================================

/**
 * Parameters for building a CREATE PACT transaction
 */
export interface CreatePactParams {
  /** User's wallet address */
  userAddress: Address;

  /** UTxO to consume for one-time minting */
  utxoRef: OutputReference;

  /** List of qualified member credentials */
  qualifiedMembers: Credential[];

  /** Governance pact metadata */
  pactDatum: GovernancePactDatum;

  /** Base asset name (without CIP-068 label) */
  assetName: string;
}

/**
 * Parameters for building a CLAIM TOKEN transaction
 */
export interface ClaimTokenParams {
  /** User's wallet address (must be in qualified members list) */
  userAddress: Address;

  /** Distribution validator UTxO containing tokens */
  distributionUtxo: OutputReference;

  /** Distribution datum */
  distributionDatum: DistributionDatum;
}

/**
 * Parameters for building a CAST VOTE transaction
 */
export interface CastVoteParams {
  /** User's wallet address */
  userAddress: Address;

  /** Policy ID of the governance tokens */
  policyId: PolicyId;

  /** User token asset name (with CIP-068 label 222) */
  userTokenName: AssetName;

  /** Vote choice */
  vote: 'Yes' | 'No';
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Result of a transaction build
 */
export interface TxBuildResult {
  success: boolean;
  txHash?: TxHash;
  error?: string;
}

/**
 * Token information
 */
export interface TokenInfo {
  policyId: PolicyId;
  assetName: AssetName;
  quantity: number;
}
