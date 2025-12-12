/**
 * Test the new P icon with chunked Base64
 */

import { PACT_ICON_BLUE_SVG, getGovernanceIcon, ICON_METADATA } from '../lib/governance-icon';
import { svgToChunkedDataUri, getChunkStats, validateChunks } from '../lib/base64-chunker';
import { buildTokenMetadata } from '../lib/metadata';

console.log('\n🎨 Testing P Icon for Governance Tokens\n');

// Test 1: Show icon metadata
console.log('=== Available Icons ===');
Object.entries(ICON_METADATA).forEach(([key, info]) => {
  console.log(`\n${key}:`);
  console.log(`  Name: ${info.name}`);
  console.log(`  Size: ${info.sizeBytes} bytes`);
  console.log(`  Chunks: ${info.chunksCount}`);
  console.log(`  Color: ${info.color}`);
});

// Test 2: Convert P icon to chunks
console.log('\n\n=== Converting P Icon to Chunks ===');
const chunks = svgToChunkedDataUri(PACT_ICON_BLUE_SVG, 64);
const stats = getChunkStats(chunks);

console.log(`Total chunks: ${stats.totalChunks}`);
console.log(`Total size: ${stats.totalBytes} bytes (${stats.totalKB.toFixed(2)} KB)`);
console.log(`Average chunk size: ${stats.averageChunkSize.toFixed(1)} chars`);
console.log(`Max chunk size: ${stats.maxChunkSize} chars`);
console.log(`All chunks valid (≤64 chars)? ${validateChunks(chunks, 64) ? '✅ YES' : '❌ NO'}`);

// Test 3: Show first and last chunks
console.log('\n\n=== Sample Chunks ===');
console.log(`First chunk [0] (${chunks[0].length} chars):`);
console.log(`  "${chunks[0]}"`);
console.log(`\nSecond chunk [1] (${chunks[1].length} chars):`);
console.log(`  "${chunks[1]}"`);
console.log(`\nLast chunk [${chunks.length - 1}] (${chunks[chunks.length - 1].length} chars):`);
console.log(`  "${chunks[chunks.length - 1]}"`);

// Test 4: Build full metadata with P icon
console.log('\n\n=== Building Metadata with P Icon ===');
const metadata = buildTokenMetadata(
  'fc74b202751b95288869bddd1c55ed554f79238bcc264b104e5d1cd4',
  '001bc280626c6f636b566f74655061637431373635323239323935333832',
  {
    title: 'Cardano Critical Budget',
    description: 'Vote on 2025 critical budget allocation',
    cardanoActionId: '8f54d021c6e6fcdd5a4908f10a7b092fa31cd94db2e809f2e06d7ffa4d78773d#0',
    cardanoActionType: 'TreasuryWithdrawals',
    votingDeadline: 1765835092000,
    totalMembers: 10,
    requiredVotes: 6,
  },
  {
    includeImage: true,  // Use chunked P icon
  }
);

console.log('\nMetadata structure:');
const metadataJson = JSON.stringify(metadata, null, 2);
console.log(metadataJson.substring(0, 500) + '...\n');

console.log(`Total metadata size: ${metadataJson.length} bytes`);
console.log(`Image field type: ${Array.isArray(metadata['721'][Object.keys(metadata['721'])[0]][Object.keys(metadata['721'][Object.keys(metadata['721'])[0]])[0]].image) ? 'Array (chunked)' : 'String'}`);

const imageField = metadata['721'][Object.keys(metadata['721'])[0]][Object.keys(metadata['721'][Object.keys(metadata['721'])[0]])[0]].image;
if (Array.isArray(imageField)) {
  console.log(`Image chunks: ${imageField.length}`);
  console.log(`✅ Ready for Lucid Evolution!`);
}

// Test 5: Estimate transaction cost
console.log('\n\n=== Transaction Cost Estimate ===');
const baseMetadataSize = 400; // No image
const withImageSize = metadataJson.length;
const extraBytes = withImageSize - baseMetadataSize;
const byteFee = 0.000043946; // ADA per byte
const extraCost = extraBytes * byteFee;

console.log(`Baseline metadata: ~${baseMetadataSize} bytes`);
console.log(`With P icon: ${withImageSize} bytes`);
console.log(`Extra size: ${extraBytes} bytes`);
console.log(`Extra cost: ~${extraCost.toFixed(6)} ADA (~$${(extraCost * 0.45).toFixed(4)} USD)`);

console.log('\n✅ P Icon test complete!\n');
