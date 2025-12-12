# blockVote

Collective accountability for Cardano Governance through fractionalized NFT voting.

## Overview

blockVote is a Cardano dApp that enables collective governance voting through NFT fractionalization. Governance action NFTs are fractionalized using the Fracada smart contract, with tokens distributed to qualified DRep members for democratic voting.

## Problem & Solution

**Problem:** Small DReps cannot assess if their participation in Cardano governance has impact.

**Solution:** Block voting - qualified members vote as a unified pack, amplifying their collective voice.

## Technology Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript
- **Styling:** Tailwind CSS
- **Cardano Integration:** Mesh SDK v1.9
- **Smart Contracts:** Fracada (NFT fractionalization) + Custom governance contracts
- **Infrastructure:** Public Cardano Testnets (Preprod/Preview) + Demeter.run

## Prerequisites

- Node.js v20+ (using NVM recommended)
- A Cardano wallet browser extension (Nami, Eternl, Flint, etc.)
- Wallet configured for **Preprod Testnet**

## Installation

### 1. Install Node.js

Using NVM (recommended):
```bash
nvm install 20
nvm use 20
```

Or install directly from https://nodejs.org/

### 2. Clone and Install Dependencies

```bash
cd block-vote
npm install
```

### 3. Configure Environment

Copy `.env.local` and update with your settings:

```bash
# Cardano Network Configuration
NEXT_PUBLIC_CARDANO_NETWORK=preprod

# Optional: Demeter.run endpoints (when you set up your workspace)
# DEMETER_CARDANO_NODE_URL=https://[your-workspace].demeter.run
# DEMETER_OGMIOS_URL=https://[your-workspace].demeter.run/ogmios
# DEMETER_KUPO_URL=https://[your-workspace].demeter.run/kupo
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
block-vote/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with Cardano provider
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── MeshProvider.tsx  # Cardano/Mesh context provider
│   └── WalletConnect.tsx # Wallet connection component
├── .env.local            # Environment configuration
└── next.config.ts        # Next.js configuration
```

## Development Roadmap

### ✅ Phase 1: Research & Planning
- Research Fracada smart contracts
- Analyze Mesh SDK capabilities
- Design system architecture

### ✅ Phase 2: Foundation (CURRENT)
- Next.js + TypeScript + Tailwind setup
- Mesh SDK integration
- Wallet connection working

### 🔄 Phase 3: Fracada Integration (MVP Core)
- Integrate Fracada smart contract
- NFT fractionalization interface
- Token distribution mechanism

### ⏳ Phase 4: Voting System (MVP Core)
- Anonymous voting via token return
- Threshold tracking
- Vote outcome determination

### ⏳ Phase 5: Member Management
- DRep verification (must BE an active DRep)
- Policy ID token gating
- Member status tracking

### ⏳ Phase 6+: Advanced Features
- Accountability & challenge system
- Incentives & punishments
- Dashboard & analytics

## Member Qualification Requirements

To participate in blockVote, members must meet **BOTH** requirements:

1. **Be an active DRep** (not just delegated to one)
   - Member's stake address must be registered as a DRep
   - DRep registration must be active on-chain

2. **Hold specific Policy ID token** (token gating)
   - Wallet must hold ≥1 token from designated policy ID

### Future Enhancement:
- DRep delegation threshold: < 10 million ADA delegated
- Prevents whale DReps from dominating
- Ensures grassroots, community-focused participation

## PAC $PACK Rules

**Requirements:**
- Vote as unified pack
- Minimum < (n) delegated ADA
- Secure voting wallet
- Vote in all possible governance actions

**Punishment:** Banishment from pack

**Remediation:**
- Pay fine
- Perform repentance tasks

**Incentives:**
- $ADA rewards
- $CNT tokens
- IRL exclusivity benefits
- Tools and services access
- Educational resources

## Testing on Preprod Testnet

### 1. Configure Wallet for Preprod
- Open your Cardano wallet extension
- Switch network to **Preprod Testnet**

### 2. Get Test ADA
Visit the Cardano Testnet Faucet:
- https://docs.cardano.org/cardano-testnet/tools/faucet/

### 3. Connect Wallet
- Open the dApp
- Click "Connect Wallet"
- Select your wallet and approve

## Using Demeter.run (Optional)

For advanced blockchain queries and infrastructure:

1. Sign up at https://demeter.run/
2. Create a new project: "blockVote-dev"
3. Create workspace with:
   - Cardano Node (Preprod)
   - Ogmios (for queries)
   - Kupo (for indexing)
4. Copy API endpoints to `.env.local`

**Pricing:** Pay-per-use, ~$5-15/month for development

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Contributing

This project is in active development. Please see the project timeline and roadmap in the `/coLab` directory documentation.

## Resources

- [Fracada dApp](https://fracada.adaodapp.xyz/)
- [Fracada dApp Repo](https://github.com/ADAOcommunity/fracada-dapp)
- [Fracada Plutus Starter](https://github.com/adrian1-dot/fracada-plutus-starter)
- [Mesh SDK Docs](https://meshjs.dev/)
- [Cardano Developer Portal](https://developers.cardano.org/)
- [Demeter.run](https://demeter.run/)
- [CIP-1694 Governance](https://cips.cardano.org/cip/CIP-1694)

## License

MIT
