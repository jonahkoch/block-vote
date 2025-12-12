/**
 * Governance Token SVG Icons
 *
 * Collection of SVG icons for governance tokens
 */

/**
 * "P" icon (Pact) - Original design
 * Size: 1,165 bytes
 * Chunks: 25 (when Base64 encoded)
 */
export const PACT_ICON_SVG = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="377.337px" height="377.338px" viewBox="0 0 377.337 377.338" style="enable-background:new 0 0 377.337 377.338;" xml:space="preserve">
<g>
	<path d="M301.687,53.505H75.648c-10.876,0-19.725,8.843-19.725,19.713v230.904c0,10.873,8.843,19.722,19.725,19.722h226.039
		c10.873,0,19.722-8.844,19.722-19.722V73.218C321.404,62.348,312.56,53.505,301.687,53.505z M200.272,148.947
		c0,7.587-3.885,14.187-11.633,19.825c-7.762,5.637-16.648,8.455-26.672,8.455h-38.166v51.799H85.892V76.356h76.203
		c10.025,0,18.889,2.834,26.605,8.506c7.704,5.669,11.564,12.26,11.564,19.773v44.312H200.272z M123.808,104.534h38.558v44.506
		h-38.558V104.534z M338.674,0H38.66C19.092,0,3.223,15.869,3.223,35.434v306.462c0,19.573,15.869,35.442,35.437,35.442h300.02
		c19.568,0,35.436-15.869,35.436-35.442V35.434C374.115,15.869,358.248,0,338.674,0z M335.378,304.122
		c0,18.572-15.113,33.691-33.691,33.691H75.648c-18.576,0-33.695-15.114-33.695-33.691V73.218c0-18.569,15.114-33.688,33.695-33.688
		h226.039c18.572,0,33.691,15.114,33.691,33.688V304.122z"/>
</g>
</svg>`;

/**
 * Customized "P" icon with cyan color (visible on dark backgrounds)
 * Size: ~1,200 bytes
 * Chunks: ~26 (when Base64 encoded)
 */
export const PACT_ICON_BLUE_SVG = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="377.337px" height="377.338px" viewBox="0 0 377.337 377.338" xml:space="preserve">
<g>
	<path fill="#6FEEE1" d="M301.687,53.505H75.648c-10.876,0-19.725,8.843-19.725,19.713v230.904c0,10.873,8.843,19.722,19.725,19.722h226.039
		c10.873,0,19.722-8.844,19.722-19.722V73.218C321.404,62.348,312.56,53.505,301.687,53.505z M200.272,148.947
		c0,7.587-3.885,14.187-11.633,19.825c-7.762,5.637-16.648,8.455-26.672,8.455h-38.166v51.799H85.892V76.356h76.203
		c10.025,0,18.889,2.834,26.605,8.506c7.704,5.669,11.564,12.26,11.564,19.773v44.312H200.272z M123.808,104.534h38.558v44.506
		h-38.558V104.534z M338.674,0H38.66C19.092,0,3.223,15.869,3.223,35.434v306.462c0,19.573,15.869,35.442,35.437,35.442h300.02
		c19.568,0,35.436-15.869,35.436-35.442V35.434C374.115,15.869,358.248,0,338.674,0z M335.378,304.122
		c0,18.572-15.113,33.691-33.691,33.691H75.648c-18.576,0-33.695-15.114-33.695-33.691V73.218c0-18.569,15.114-33.688,33.695-33.688
		h226.039c18.572,0,33.691,15.114,33.691,33.688V304.122z"/>
</g>
</svg>`;

/**
 * Vote checkmark icon (alternative)
 * Size: ~1,100 bytes
 * Simpler design for faster loading
 */
export const VOTE_ICON_SVG = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
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
</svg>`;

/**
 * Get the recommended icon for governance tokens
 */
export function getGovernanceIcon(): string {
  return PACT_ICON_BLUE_SVG;  // Default to blue P icon
}

/**
 * Icon metadata
 */
export const ICON_METADATA = {
  PACT_ICON: {
    name: 'Pact Icon (Original)',
    svg: PACT_ICON_SVG,
    sizeBytes: 1165,
    chunksCount: 25,
    color: 'black',
  },
  PACT_ICON_BLUE: {
    name: 'Pact Icon (Cyan)',
    svg: PACT_ICON_BLUE_SVG,
    sizeBytes: 1200,
    chunksCount: 26,
    color: '#6FEEE1',
  },
  VOTE_ICON: {
    name: 'Vote Icon (Ballot Box)',
    svg: VOTE_ICON_SVG,
    sizeBytes: 1111,
    chunksCount: 24,
    color: 'gradient',
  },
};
