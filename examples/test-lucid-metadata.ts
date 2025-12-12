/**
 * Test Lucid Evolution's metadata handling
 *
 * This script tests what metadata structures Lucid Evolution accepts
 */

import { buildTokenMetadata } from '../lib/metadata';

console.log('\n🧪 Testing Lucid Evolution Metadata Structures\n');

const testPolicyId = 'fc74b202751b95288869bddd1c55ed554f79238bcc264b104e5d1cd4';
const testAssetName = '001bc280626c6f636b566f74655061637431373635323239323935333832';

const baseMetadata = {
  title: 'Test Token',
  description: 'Testing metadata structures',
  cardanoActionId: '8f54d021c6e6fcdd5a4908f10a7b092fa31cd94db2e809f2e06d7ffa4d78773d#0',
  cardanoActionType: 'InfoAction' as const,
  votingDeadline: 1765835092000,
  totalMembers: 10,
  requiredVotes: 6,
};

// Test 1: No image (baseline)
console.log('=== Test 1: No image ===');
const noImage = buildTokenMetadata(testPolicyId, testAssetName, baseMetadata);
console.log('Structure:', JSON.stringify(noImage, null, 2).substring(0, 300));
console.log('Size:', JSON.stringify(noImage).length, 'bytes');
console.log('✅ Should work\n');

// Test 2: IPFS URL
console.log('=== Test 2: IPFS URL ===');
const ipfsImage = buildTokenMetadata(testPolicyId, testAssetName, baseMetadata, {
  imageIpfsUrl: 'ipfs://bafybeig3k2bn4qp8tmzkvy1jrccmkbns5chjhhm'
});
console.log('Image field:', ipfsImage['721'][testPolicyId][testAssetName].image);
console.log('Image type:', typeof ipfsImage['721'][testPolicyId][testAssetName].image);
console.log('✅ Should work\n');

// Test 3: Chunked array
console.log('=== Test 3: Chunked array ===');
const chunkedImage = buildTokenMetadata(testPolicyId, testAssetName, baseMetadata, {
  includeImage: true
});
const imageField = chunkedImage['721'][testPolicyId][testAssetName].image;
console.log('Image type:', Array.isArray(imageField) ? 'Array' : typeof imageField);
if (Array.isArray(imageField)) {
  console.log('Array length:', imageField.length);
  console.log('First chunk:', imageField[0].substring(0, 50) + '...');
  console.log('Last chunk length:', imageField[imageField.length - 1].length);
}
console.log('❓ FAILING - Lucid rejects this\n');

// Test 4: Manual test with simple array
console.log('=== Test 4: Simple array test ===');
const simpleArray = {
  '721': {
    [testPolicyId]: {
      [testAssetName]: {
        name: 'Test',
        image: ['chunk1', 'chunk2', 'chunk3'],
        mediaType: 'image/svg+xml'
      }
    }
  }
};
console.log('Structure:', JSON.stringify(simpleArray, null, 2));
console.log('❓ Will Lucid accept this?\n');

// Analysis
console.log('=== Analysis ===');
console.log('The error "invalid value: map, expected invalid tx metadatum" suggests:');
console.log('1. Lucid is using cardano-node\'s JSON format for metadata');
console.log('2. This format may not support arrays of strings the same way');
console.log('3. CIP-25 DOES support arrays, but Lucid\'s parser is stricter');
console.log('');
console.log('Possible solutions:');
console.log('A. Use IPFS URL instead (recommended)');
console.log('B. Investigate Lucid\'s exact metadata format requirements');
console.log('C. Use Mesh SDK for transactions with embedded images');
console.log('D. Manually construct metadata in proper CBOR format');
