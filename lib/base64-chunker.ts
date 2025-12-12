/**
 * Base64 Chunking for Lucid Evolution Metadata
 *
 * Lucid Evolution enforces a 64-character limit on all metadata strings.
 * This utility splits long Base64 strings into chunks of ≤64 characters
 * that can be stored in an array.
 */

/**
 * Split a data URI into chunks for Lucid Evolution metadata
 *
 * IMPORTANT: Lucid enforces 64-char limit on the SERIALIZED JSON string.
 * When an array is serialized, each element gets quotes and commas:
 * ["chunk1","chunk2"] where each chunk becomes "chunk",
 * So a 64-char chunk becomes 66+ chars in JSON (quotes + comma).
 *
 * We use 58 chars per chunk to be safe with JSON serialization overhead.
 * This accounts for: "chunk" (2 chars) + , (1 char) + spacing (1 char) = 62 total
 *
 * @param dataUri - Full data URI (e.g., "data:image/svg+xml;base64,PHN2...")
 * @param chunkSize - Maximum characters per chunk (default: 58 to account for JSON overhead)
 * @returns Array of strings, each ≤ chunkSize characters
 *
 * @example
 * ```typescript
 * const svg = '<svg>...</svg>';
 * const dataUri = svgToDataUri(svg);
 * const chunks = chunkDataUri(dataUri);
 *
 * // Use in metadata
 * const metadata = {
 *   '721': {
 *     [policyId]: {
 *       [assetName]: {
 *         name: "Token Name",
 *         image: chunks,  // Array of 58-char strings (62 with JSON overhead)
 *         mediaType: "image/svg+xml"
 *       }
 *     }
 *   }
 * };
 * ```
 */
export function chunkDataUri(dataUri: string, chunkSize: number = 58): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < dataUri.length; i += chunkSize) {
    chunks.push(dataUri.substring(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Convert SVG string to Base64 data URI
 *
 * @param svg - SVG content as string
 * @returns Base64-encoded data URI
 */
export function svgToDataUri(svg: string): string {
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Convert SVG to chunked data URI array for Lucid Evolution
 *
 * This is the main function you'll use - it handles both conversion and chunking.
 *
 * @param svg - SVG content as string
 * @param chunkSize - Maximum characters per chunk (default: 60 to account for JSON serialization)
 * @returns Array of strings suitable for Lucid Evolution metadata
 *
 * @example
 * ```typescript
 * const svg = `
 *   <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
 *     <circle cx="150" cy="150" r="100" fill="#0033AD"/>
 *   </svg>
 * `;
 *
 * const imageChunks = svgToChunkedDataUri(svg);
 *
 * const metadata = {
 *   '721': {
 *     [policyId]: {
 *       [assetName]: {
 *         name: "Governance Token",
 *         image: imageChunks,  // ✅ Works with Lucid Evolution
 *         mediaType: "image/svg+xml"
 *       }
 *     }
 *   }
 * };
 * ```
 */
export function svgToChunkedDataUri(svg: string, chunkSize: number = 58): string[] {
  const dataUri = svgToDataUri(svg);
  return chunkDataUri(dataUri, chunkSize);
}

/**
 * Convert PNG/JPG buffer to chunked data URI array
 *
 * @param buffer - Image buffer (from fs.readFileSync or upload)
 * @param mimeType - MIME type (e.g., 'image/png', 'image/jpeg')
 * @param chunkSize - Maximum characters per chunk (default: 60 to account for JSON serialization)
 * @returns Array of strings suitable for Lucid Evolution metadata
 *
 * @example
 * ```typescript
 * import fs from 'fs';
 *
 * const imageBuffer = fs.readFileSync('./token-image.png');
 * const imageChunks = imageToChunkedDataUri(imageBuffer, 'image/png');
 * ```
 */
export function imageToChunkedDataUri(
  buffer: Buffer,
  mimeType: string,
  chunkSize: number = 58
): string[] {
  const base64 = buffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64}`;
  return chunkDataUri(dataUri, chunkSize);
}

/**
 * Reassemble chunked data URI (for testing/validation)
 *
 * @param chunks - Array of data URI chunks
 * @returns Complete data URI
 */
export function reassembleDataUri(chunks: string[]): string {
  return chunks.join('');
}

/**
 * Validate that all chunks are within size limit
 *
 * @param chunks - Array of strings to validate
 * @param maxSize - Maximum characters per chunk (default: 60 to account for JSON serialization)
 * @returns true if all chunks are valid, false otherwise
 */
export function validateChunks(chunks: string[], maxSize: number = 58): boolean {
  return chunks.every(chunk => chunk.length <= maxSize);
}

/**
 * Calculate total size of chunked data
 *
 * @param chunks - Array of data URI chunks
 * @returns Total size info
 */
export function getChunkStats(chunks: string[]): {
  totalChunks: number;
  totalBytes: number;
  totalKB: number;
  averageChunkSize: number;
  maxChunkSize: number;
} {
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const maxChunkSize = Math.max(...chunks.map(c => c.length));

  return {
    totalChunks: chunks.length,
    totalBytes,
    totalKB: totalBytes / 1024,
    averageChunkSize: totalBytes / chunks.length,
    maxChunkSize,
  };
}
