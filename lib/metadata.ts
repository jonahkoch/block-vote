/**
 * BlockVote Token Metadata Generation
 *
 * Generates CIP-25 compliant metadata for governance tokens
 * Uses on-chain SVG images (no IPFS dependencies for MVP)
 */

import { getGovernanceIcon, PACT_ICON_BLUE_SVG } from './governance-icon';

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate SVG image for governance voting token
 * @param pactTitle - Title of the governance pact (optional, for custom SVG)
 * @returns SVG string
 */
export function generateGovernanceTokenSVG(pactTitle?: string): string {
  // Use the new P icon by default
  return getGovernanceIcon();

  // Alternative: Keep the custom generated SVG
  // Uncomment below to use title-based SVG instead
  /*
  if (!pactTitle) return getGovernanceIcon();

  const displayTitle = pactTitle.length > 25
    ? pactTitle.substring(0, 22) + '...'
    : pactTitle;

  return `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="300" height="300" fill="url(#grad)"/>
  <circle cx="150" cy="120" r="40" fill="white" opacity="0.2"/>
  <text x="150" y="135" font-size="48" fill="white" text-anchor="middle" font-family="Arial, sans-serif">✓</text>
  <text x="150" y="200" font-size="20" fill="white" text-anchor="middle" font-weight="bold" font-family="Arial, sans-serif">BLOCKVOTE</text>
  <text x="150" y="230" font-size="14" fill="#e0e7ff" text-anchor="middle" font-family="Arial, sans-serif">${escapeXml(displayTitle)}</text>
  <text x="150" y="260" font-size="12" fill="#c7d2fe" text-anchor="middle" font-family="Arial, sans-serif">Voting Token</text>
</svg>`.trim();
  */
}

/**
 * Escape XML special characters in SVG text
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert SVG string to Base64 data URI
 * @param svg - SVG string
 * @returns data:image/svg+xml;base64,<encoded>
 */
export function svgToDataUri(svg: string): string {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// ============================================================================
// CIP-25 Metadata
// ============================================================================

export interface GovernancePactMetadata {
  title: string;
  description: string;
  cardanoActionId: string;
  cardanoActionType: string;
  votingDeadline: number;
  totalMembers: number;
  requiredVotes: number;
}

/**
 * Build CIP-25 compliant metadata for governance token
 * @param policyId - Minting policy hash (script hash)
 * @param assetName - Token asset name (hex encoded)
 * @param metadata - Governance pact metadata
 * @param options - Metadata options
 * @returns CIP-25 metadata object
 */
export function buildTokenMetadata(
  policyId: string,
  assetName: string,
  metadata: GovernancePactMetadata,
  options: {
    includeImage?: boolean;
    imageIpfsUrl?: string;
  } = {}
) {
  // Generate SVG
  const svg = generateGovernanceTokenSVG(metadata.title);

  // Build CIP-25 metadata
  // Ensure the name field is ≤64 chars for Lucid Evolution
  const tokenName = `${metadata.title} - Voting Token`;
  const truncatedName = tokenName.length > 64
    ? tokenName.substring(0, 61) + '...'
    : tokenName;

  // Prepare image field based on options
  let imageField: string | string[] | undefined;

  if (options.imageIpfsUrl) {
    // Option 1: Use IPFS URL (recommended - fits in 64 chars)
    imageField = options.imageIpfsUrl;
  } else if (options.includeImage) {
    // Option 2: Embed SVG as chunked Base64 array (fits Lucid's 64-char limit)
    // Each chunk is ≤64 chars, wallets will concatenate them
    const { svgToChunkedDataUri } = require('./base64-chunker');
    imageField = svgToChunkedDataUri(svg, 64);
  }
  // Option 3: No image (default)

  return {
    '721': {
      [policyId]: {
        [assetName]: {
          name: truncatedName,
          description: metadata.description,
          ...(imageField && { image: imageField }),
          ...(imageField && { mediaType: 'image/svg+xml' }),

          // Custom governance properties (queryable on-chain)
          // IMPORTANT: All values must be strings for Cardano metadatum format
          cardano_action_id: metadata.cardanoActionId,
          cardano_action_type: metadata.cardanoActionType,
          voting_deadline: metadata.votingDeadline.toString(),
          total_members: metadata.totalMembers.toString(),
          required_votes: metadata.requiredVotes.toString(),
        },
      },
    },
  };
}

/**
 * Estimate metadata size in bytes
 * @param metadata - CIP-25 metadata object
 * @returns Size in bytes
 */
export function estimateMetadataSize(metadata: Record<string, unknown>): number {
  const json = JSON.stringify(metadata);
  return new Blob([json]).size;
}

/**
 * Check if metadata fits in transaction (max 16KB)
 */
export function validateMetadataSize(metadata: Record<string, unknown>): {
  valid: boolean;
  size: number;
  maxSize: number;
} {
  const MAX_TX_SIZE = 16384; // 16KB in bytes
  const size = estimateMetadataSize(metadata);

  return {
    valid: size < MAX_TX_SIZE,
    size,
    maxSize: MAX_TX_SIZE,
  };
}
