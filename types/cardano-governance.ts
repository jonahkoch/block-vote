// Types for Cardano on-chain governance actions from gov.tools API
// API: https://be.gov.tools/proposal/list

export interface CardanoGovernanceAction {
  id: string;
  txHash: string;
  index: number;
  type: string; // "InfoAction", "TreasuryWithdrawals", "UpdateCommittee", etc.
  details: {
    data: {
      tag: string;
    };
  };
  expiryDate: string; // ISO 8601 format
  expiryEpochNo: number;
  createdDate: string; // ISO 8601 format
  createdEpochNo: number;
  url: string; // IPFS URL to full proposal
  metadataHash: string;
  protocolParams: any | null;
  title: string;
  abstract: string; // Main description
  motivation?: string;
  rationale?: string;
  dRepYesVotes: number;
  dRepNoVotes: number;
  dRepAbstainVotes: number;
  poolYesVotes: number;
  poolNoVotes: number;
  poolAbstainVotes: number;
  ccYesVotes: number;
  ccNoVotes: number;
  ccAbstainVotes: number;
  prevGovActionIndex: number | null;
  prevGovActionTxHash: string | null;
  json: any; // Full CIP-108 metadata
}

export interface GovernanceActionListResponse {
  page: number;
  pageSize: number;
  total: number;
  elements: CardanoGovernanceAction[];
}

export type CardanoNetwork = 'mainnet' | 'preview' | 'preprod';

// Epoch durations in milliseconds
export const EPOCH_DURATIONS: Record<CardanoNetwork, number> = {
  mainnet: 5 * 24 * 60 * 60 * 1000, // 5 days
  preview: 30 * 60 * 1000, // 30 minutes
  preprod: 5 * 24 * 60 * 60 * 1000, // 5 days
};

// Calculate blockVote deadline (3 epochs before Cardano gov action expires)
export function calculateBlockVoteDeadline(
  expiryDate: string,
  network: CardanoNetwork
): Date {
  const threeEpochs = EPOCH_DURATIONS[network] * 3;
  const expiryMs = new Date(expiryDate).getTime();
  const deadlineMs = expiryMs - threeEpochs;
  return new Date(deadlineMs);
}

// Format epoch duration for display
export function formatEpochDuration(network: CardanoNetwork): string {
  const duration = EPOCH_DURATIONS[network];
  const hours = duration / (60 * 60 * 1000);

  if (hours < 1) {
    const minutes = duration / (60 * 1000);
    return `${minutes} minutes`;
  } else if (hours < 24) {
    return `${hours} hours`;
  } else {
    const days = hours / 24;
    return `${days} days`;
  }
}

// Check if governance action has expired
export function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate).getTime() < Date.now();
}

// Calculate time remaining until expiry
export function getTimeRemaining(expiryDate: string): string {
  const now = Date.now();
  const expiry = new Date(expiryDate).getTime();
  const diff = expiry - now;

  if (diff <= 0) return 'EXPIRED';

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Format vote counts for display
export function formatVoteCount(votes: number): string {
  if (votes >= 1_000_000_000_000) {
    return `${(votes / 1_000_000_000_000).toFixed(1)}T`;
  } else if (votes >= 1_000_000_000) {
    return `${(votes / 1_000_000_000).toFixed(1)}B`;
  } else if (votes >= 1_000_000) {
    return `${(votes / 1_000_000).toFixed(1)}M`;
  } else if (votes >= 1_000) {
    return `${(votes / 1_000).toFixed(1)}K`;
  }
  return votes.toString();
}
