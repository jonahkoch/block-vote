/**
 * Example: Using Chunked Base64 Images with Lucid Evolution
 *
 * This demonstrates how to embed images in metadata while respecting
 * Lucid Evolution's 64-character limit by splitting into chunks.
 */

import { svgToChunkedDataUri, getChunkStats, validateChunks } from '../lib/base64-chunker';
import { buildTokenMetadata } from '../lib/metadata';

// Example 1: Embed SVG as chunked array
function exampleEmbeddedSVG() {
  const svg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardanoBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0033AD;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0D47A1;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="150" cy="150" r="140" fill="url(#cardanoBlue)" stroke="#FFFFFF" stroke-width="4"/>
      <rect x="90" y="130" width="120" height="100" fill="#FFFFFF" rx="8"/>
      <rect x="100" y="120" width="100" height="15" fill="#0033AD" rx="3"/>
      <rect x="120" y="80" width="60" height="50" fill="#E3F2FD" stroke="#0033AD" stroke-width="2" rx="3"/>
      <path d="M 135 100 L 145 110 L 160 90" stroke="#00C853" stroke-width="4" stroke-linecap="round" fill="none"/>
      <text x="150" y="270" font-family="Arial, sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="#FFFFFF">
        VOTE
      </text>
    </svg>
  `;

  // Convert to chunked array
  const imageChunks = svgToChunkedDataUri(svg, 64);

  // Validate all chunks are ≤64 chars
  console.log('All chunks valid?', validateChunks(imageChunks, 64));

  // Get statistics
  const stats = getChunkStats(imageChunks);
  console.log('Chunk statistics:', stats);
  // Output:
  // {
  //   totalChunks: 24,
  //   totalBytes: 1485,
  //   totalKB: 1.45,
  //   averageChunkSize: 61.875,
  //   maxChunkSize: 64
  // }

  // Use in metadata
  const metadata = buildTokenMetadata(
    'fc74b202751b95288869bddd1c55ed554f79238bcc264b104e5d1cd4',
    '001bc280626c6f636b566f74655061637431373635323239323935333832',
    {
      title: 'Cardano Governance Action',
      description: 'Vote on blockchain governance',
      cardanoActionId: '8f54d021c6e6fcdd5a4908f10a7b092fa31cd94db2e809f2e06d7ffa4d78773d#0',
      cardanoActionType: 'InfoAction',
      votingDeadline: 1765835092000,
      totalMembers: 10,
      requiredVotes: 6,
    },
    {
      includeImage: true,  // ✅ Embed as chunked array
    }
  );

  console.log('Metadata with embedded image:', JSON.stringify(metadata, null, 2));

  return metadata;
}

// Example 2: Use IPFS URL (recommended)
function exampleIPFSImage() {
  const metadata = buildTokenMetadata(
    'fc74b202751b95288869bddd1c55ed554f79238bcc264b104e5d1cd4',
    '001bc280626c6f636b566f74655061637431373635323239323935333832',
    {
      title: 'Cardano Governance Action',
      description: 'Vote on blockchain governance',
      cardanoActionId: '8f54d021c6e6fcdd5a4908f10a7b092fa31cd94db2e809f2e06d7ffa4d78773d#0',
      cardanoActionType: 'InfoAction',
      votingDeadline: 1765835092000,
      totalMembers: 10,
      requiredVotes: 6,
    },
    {
      imageIpfsUrl: 'ipfs://bafybeig3k2bn4qp8tmzkvy1jrccmkbns5chjhhm',  // ✅ IPFS URL
    }
  );

  console.log('Metadata with IPFS image:', JSON.stringify(metadata, null, 2));

  return metadata;
}

// Example 3: No image (smallest transaction)
function exampleNoImage() {
  const metadata = buildTokenMetadata(
    'fc74b202751b95288869bddd1c55ed554f79238bcc264b104e5d1cd4',
    '001bc280626c6f636b566f74655061637431373635323239323935333832',
    {
      title: 'Cardano Governance Action',
      description: 'Vote on blockchain governance',
      cardanoActionId: '8f54d021c6e6fcdd5a4908f10a7b092fa31cd94db2e809f2e06d7ffa4d78773d#0',
      cardanoActionType: 'InfoAction',
      votingDeadline: 1765835092000,
      totalMembers: 10,
      requiredVotes: 6,
    }
    // No image options - defaults to no image
  );

  console.log('Metadata without image:', JSON.stringify(metadata, null, 2));

  return metadata;
}

// Run examples
console.log('\n=== Example 1: Embedded SVG (Chunked) ===');
exampleEmbeddedSVG();

console.log('\n=== Example 2: IPFS URL ===');
exampleIPFSImage();

console.log('\n=== Example 3: No Image ===');
exampleNoImage();

/**
 * Comparison of approaches:
 *
 * 1. Chunked Embedded SVG
 *    - Pros: Self-contained, no external dependencies
 *    - Cons: ~1.5KB extra metadata, higher fees, might not render in all wallets
 *    - Use when: You need guaranteed image display regardless of IPFS availability
 *
 * 2. IPFS URL
 *    - Pros: Tiny metadata (~50 bytes), decentralized, standard-compliant
 *    - Cons: Requires IPFS upload step
 *    - Use when: Building for production (RECOMMENDED)
 *
 * 3. No Image
 *    - Pros: Smallest possible transaction, lowest fees
 *    - Cons: Generic wallet display
 *    - Use when: Image isn't important, optimizing for cost
 */
