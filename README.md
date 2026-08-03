# ChatWallet 💬💸

<p align="center">
  <img src="src/logoius.svg" alt="ChatWallet Logo" width="200" />
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://chatwallet.org"><img src="https://img.shields.io/badge/🌐-chatwallet.org-blue" alt="Website" /></a>
  <a href="https://github.com/energiasonora/chatWallet/issues"><img src="https://img.shields.io/github/issues/energiasonora/chatWallet" alt="Issues" /></a>
</p>

---

**A self-custodial, multichain wallet with end-to-end encrypted messaging. Redefining social and financial interaction in Web3.**

ChatWallet is a next-generation decentralized application that merges a secure crypto wallet with a private messenger — think **"WhatsApp meets Venmo, but sovereign."** Our mission is to build the infrastructure for a digital society where sovereignty, privacy, and honor are the default.

> If you can chat with someone, you should be able to transact with them instantly, privately, and without intermediaries.

🌐 **[chatwallet.org](https://chatwallet.org)**

---

## 📖 Table of Contents

- [🧐 About The Project](#-about-the-project)
- [✨ Core Features](#-core-features)
- [🏗️ Architecture](#-architecture)
- [🛠️ Tech Stack](#-tech-stack)
- [🚀 Getting Started](#-getting-started)
- [📦 Deploy](#-deploy)
- [📜 Contract Addresses](#-contract-addresses)
- [🗺️ Roadmap](#-roadmap)
- [🔐 XMTP End-to-End Encryption](#-xmtp-end-to-end-encryption)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [📧 Contact](#-contact)

---

## 🧐 About The Project

Today's digital world is fragmented. Financial tools are isolated from social context, and social platforms are centralized data silos. ChatWallet solves this by creating a **single, unified platform** where communication and value exchange are seamless, private, and secure.

By building on a foundation of decentralized identity (DIDs), encrypted P2P communication (XMTP), and verifiable on-chain attestations (EAS), we aim to build a healthier and more trustworthy social fabric for the internet of value.

### Why ChatWallet?

| Problem | ChatWallet Solution |
|---|---|
| Wallets can't chat | XMTP v3 — wallet-to-wallet E2E encrypted messaging |
| Chats can't pay | Send crypto directly in conversations |
| Public transaction history | p2p Stealth Addresses for private receiving |
| Centralized identity | Sovereign DIDs via Ceramic Network & OrbisDB |
| Zero reputation context | On-chain attestations (EAS) — verifiable peer claims |
| Gas friction for new users | Account Abstraction with relay server (gasless UX) |

---

## ✨ Core Features

- 🔐 **Self-Custodial Wallet (BIP39)** — Your keys, your crypto. EVM-compatible at launch, multichain by design.
- 💬 **Encrypted P2P Chat (XMTP v3)** — Truly private, wallet-to-wallet communication. No one, not even us, can read your messages.
- 👻 **Financial Privacy (Stealth Addresses)** — Protect your on-chain history with untraceable, single-use addresses for receiving assets. Default on p2p chats.
- 👤 **Sovereign Identity (DIDs)** — Full control over your digital self using Ceramic Network and OrbisDB. *You are not the product.*
- 🤝 **Verifiable Reputation (EAS Attestations)** — Build a web of trust through verifiable on-chain claims made by peers.
- 🤖 **Account Abstraction (SCAs)** — Smart Contract Accounts with gasless transactions via a relay server. Social recovery ready.
- 🔗 **Multichain by Design** — Built from the ground up to support multiple blockchain ecosystems (EVM first, Solana planned).
- 📦 **Decentralized Storage (IPFS via Storacha)** — Profile data and attestations stored resiliently, without central points of failure. UCAN-based permissioned uploads.
- 🏦 **Multisig for Group Chats** — Shared wallets controlled by group consensus.
- 📱 **PWA (Progressive Web App)** — Installable on mobile and desktop, works offline in cold-wallet mode.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER (PWA)                         │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────────┐ │
│  │  Wallet  │  │ XMTP Chat │  │ Attestations│  │ Storage Uploader │ │
│  │ (BIP39)  │  │  (E2EE)   │  │   (EAS)     │  │  (Storacha/IPFS)  │ │
│  └────┬─────┘  └─────┬─────┘  └──────┬─────┘  └────────┬─────────┘ │
│       │              │              │                   │           │
└───────┼──────────────┼──────────────┼───────────────────┼───────────┘
        │              │              │                   │
        ▼              ▼              ▼                   ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐
│  Blockchain  │ │   XMTP   │ │  Ceramic /   │ │  ChatWallet       │
│  (EVM L2s)   │ │ Network  │ │  OrbisDB     │ │  Backend          │
│              │ │          │ │              │ │  (Express /       │
│ • SCAs       │ │          │ │ • DIDs       │ │   Firebase CF)    │
│ • DID Registry│ │          │ │ • Profiles   │ │                   │
│ • Stealth    │ │          │ │              │ │ • UCAN Delegation │
│ • EAS        │ │          │ │              │ │ • Gas Relay       │
│ • Presale    │ │          │ │              │ │ • Quota Mgmt      │
└──────┬───────┘ └──────────┘ └──────────────┘ └────────┬─────────┘
       │                                                 │
       ▼                                                 ▼
┌──────────────────┐                         ┌──────────────────┐
│  Storacha/IPFS   │◄────────────────────────│  freeway Gateway │
│  Decentralized   │   Content claims +      │  (Cloudflare     │
│  Storage         │   UCAN auth             │   Worker + R2)   │
└──────────────────┘                         └──────────────────┘
```

### Project Structure

```
chatWallet/
├── src/                       # Frontend — vanilla JS SPA (no framework)
│   ├── index.html             # Landing page / marketing site
│   ├── dapp.html              # Main dApp — wallet + chat + payments
│   ├── book.html              # Address book
│   ├── js/                    # Libraries & core logic (ethers, XMTP, GSAP, QR...)
│   ├── static/                # Static assets
│   ├── uploadWorker.js        # Web Worker for decentralized uploads
│   └── service-worker.js      # PWA service worker
│
├── server.js                  # Backend — Express API
│                               #   • POST /api/delegate     → UCAN delegation for Storacha
│                               #   • POST /api/smart/relay  → Gasless SCA transactions
│                               #   • GET  /api/quota/:addr  → Storage quota check
│                               #   • POST /api/buy-quota    → Gasless quota purchase
│
├── smartContracts/             # Solidity smart contracts
│   ├── ChatSmartAccount.sol   # Smart Contract Account (ERC-4337 style)
│   ├── ChatSmartAccountFactory.sol  # SCA Factory (deterministic deployment)
│   ├── chatwalletdidv5.sol    # On-chain DID registry
│   ├── chatWalletTokenF.sol   # CWLT ERC20 token
│   ├── milestonePresaleV21.sol # Presale / fundraising contract
│   └── Subscription.sol       # Storage subscription management
│
├── chatwallet-gateway/        # IPFS Gateway (fork of web3-storage/freeway)
│   ├── src/middleware/        # UCAN handler, rate limiting, CAR format, auth...
│   └── wrangler.toml          # Cloudflare Workers config
│
├── functions/                 # Firebase Cloud Functions (production API)
│   └── index.js
│
├── poc/orbitdb-eth/           # Proof of Concept — OrbitDB with Ethereum identity
└── public/                    # Build output for Firebase deploy
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla JS + [Parcel](https://parceljs.org/) bundler + Tailwind CSS + GSAP |
| **Wallet** | [ethers.js v6](https://docs.ethers.io/v6/), MetaMask SDK, Web3Modal |
| **Messaging** | [XMTP Browser SDK v6](https://xmtp.org/) — E2E encrypted P2P chat |
| **Identity** | [Ceramic Network](https://ceramic.network/) + [OrbisDB](https://orbis.club/) |
| **Attestations** | [EAS SDK](https://attest.org/) (Ethereum Attestation Service) |
| **Stealth Addresses** | [@noble/secp256k1](https://github.com/paulmillr/noble-secp256k1) (elliptic curve crypto) |
| **Decentralized Storage** | [Storacha](https://storacha.network/) client + UCAN delegation + IPLD/CAR |
| **Backend** | Node.js + Express + Firebase Cloud Functions |
| **Smart Contracts** | Solidity + [OpenZeppelin](https://www.openzeppelin.com/contracts) |
| **Gateway** | Cloudflare Workers + R2 (fork of [freeway](https://github.com/web3-storage/freeway)) |
| **Package Manager** | Yarn |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v20+ (use [nvm](https://github.com/nvm-sh/nvm): `nvm use 20`)
- **Yarn** (v1.22+)
- A wallet with testnet ETH for development (MetaMask recommended)

### Installation

```bash
# Clone the repo
git clone git@github.com:energiasonora/chatWallet.git
cd chatWallet

# Use Node 20
nvm use 20

# Install dependencies
yarn
```

### Run Locally

You need **two terminals**:

**Terminal 1 — Backend server:**
```bash
node server.js
```

**Terminal 2 — Frontend dev server:**
```bash
# Main dApp pages
yarn parcel src/index.html src/dapp.html src/book.html --port 7777 --https

# Or for the full suite:
yarn parcel src/index.html src/dapp.html src/book.html src/stealthwallet.html src/stealthpay.html src/storage.html --port 7777 --https
```

Open `https://localhost:7777` in your browser.

> **Note:** HTTPS is required for PWA features and some browser crypto APIs. Parcel handles the self-signed cert automatically.

### Environment Variables

Copy and fill the `.env` file:
```bash
CHATWALLET_RPC=https://sepolia-rollup.arbitrum.io/rpc
SERVER_PRIVATE_KEY=your_server_ed25519_key
SPACE_PROOF=your_storacha_space_proof
SPACE_DID=did:key:your_space_did
PORT=3000
```

---

## 📦 Deploy

### Build

```bash
# Build all pages into public/
yarn parcel src/index.html src/dapp.html src/book.html src/stealthwallet.html src/stealthpay.html --dist-dir public --public-url ./
```

### Deploy to Firebase

```bash
firebase deploy
```

The function API will be live at:
```
https://us-central1-chatwallet-demo.cloudfunctions.net/api
```

---

## 📜 Contract Addresses

### Arbitrum Sepolia

| Contract | Address | Explorer |
|---|---|---|
| Milestone Presale v21 | `0x504fF398f4Bf7C597a391fCb1328bf5add7aCE44` | [Arbiscan](https://sepolia.arbiscan.io/address/0x504fF398f4Bf7C597a391fCb1328bf5add7aCE44#readContract) |
| ChatWallet Token (CWLT) | `0x2aC45C33602E1a8450302100F1897BFF6C91a5d6` | [Arbiscan](https://sepolia.arbiscan.io/address/0x2aC45C33602E1a8450302100F1897BFF6C91a5d6) |
| ChatWallet DID v5 | `0x4ccA3288A4319c9c44e8797087F8776A863342F5` | [Arbiscan](https://sepolia.arbiscan.io/address/0x4ccA3288A4319c9c44e8797087F8776A863342F5) |

### Sepolia (Ethereum)

| Contract | Address | Explorer |
|---|---|---|
| Subscription | `0xcdD92F0b9E5cd59488e533F746bb6c8dEf46eE13` | [Etherscan](https://sepolia.etherscan.io/address/0xcdD92F0b9E5cd59488e533F746bb6c8dEf46eE13) |
| Stealth Wallet | `0xA1274c2c80563BF3c483610d4e9F9e64Da8bf4B8` | [Etherscan](https://sepolia.etherscan.io/address/0xA1274c2c80563BF3c483610d4e9F9e64Da8bf4B8) |

> ✅ **Sourcify verified** — [View on Sourcify](https://repo.sourcify.dev/11155111/0xcdD92F0b9E5cd59488e533F746bb6c8dEf46eE13/)

### Monad Testnet

| Contract | Address |
|---|---|
| CWLT Token | `0x650C744D281ADeCC7808B7f0D377c07240e13a85` |
| Smart Wallet | `0x6C10f399f7131c149c8a82602F8e4bD0F474E58B` |

---

## 🗺️ Roadmap

- [x] **Phase 1 — Q3 2025: EVM Launch**
  - Core Wallet & Chat features
  - DIDs on Ceramic / OrbisDB
  - Stealth Addresses (p2p privacy)

- [x] **Phase 2 — Q4 2025: Attestations & Identity**
  - On-chain DID Registry
  - EAS-compatible attestation system
  - Decentralized storage (Storacha/IPFS)

- [x] **Phase 3 — Q1 2026: Account Abstraction**
  - Smart Contract Account (SCA) support
  - Gasless transactions (relay server)
  - Social Recovery groundwork

- [ ] **Phase 4 — Q2 2026: Ecosystem Growth**
  - Public API & Developer SDK
  - Solana integration
  - Grants program for dApps building on ChatWallet

See the [open issues](https://github.com/energiasonora/chatWallet/issues) for a full list of proposed features and known issues.

---

## 🔐 XMTP End-to-End Encryption

### How It Works

The E2E encryption is a fundamental part of the XMTP protocol and is handled **automatically** by the client library.

**Key Generation:** When `Client.create(state.wallet, ...)` is called, the SDK uses your wallet to generate a **separate set of encryption keys**. These keys are published on the XMTP network, allowing others to find them and encrypt messages for you.

**Sending Messages:** When `state.conversation.send(messageText)` is called, the SDK automatically fetches the recipient's encryption keys from the network, encrypts your message, and sends the encrypted payload.

**Receiving Messages:** `streamMessages()` receives the encrypted data. The SDK uses the **private keys** it generated during setup (which only your client has) to decrypt messages before you see them as plain text.

### 🔑 Key Security

> **Only your public keys are published on the XMTP network — never your private keys.**

Your private keys must remain secret and never leave your device. They are what allow you to decrypt messages sent to you.

**What happens during `Client.create()`:**

1. **Key Bundle Generation** — Your browser generates a new set of cryptographic keys specifically for XMTP:
   - An **identity key** (long-term public/private key pair)
   - A set of **pre-keys** (one-time public keys used to establish new secure chat sessions)

2. **Signing with Your Wallet** — Your wallet signs your new public identity key — a digital seal: *"I, the owner of this Ethereum address, authorize this public key to send and receive messages on my behalf."*

3. **Publishing to the Network** — The public part of your key bundle (public identity key, wallet signature, public pre-keys) is published to the XMTP network.

4. **When someone messages you** — Their client fetches your public bundle, verifies the signature, and uses those public keys to encrypt the first message.

---

## 🤝 Contributing

Contributions are what make the open-source community amazing. Any contributions you make are **greatly appreciated**.

If you have a suggestion, please fork the repo and create a pull request. You can also open an issue with the tag `"enhancement"`.

1. **Fork the Project**
2. **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the Branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 📧 Contact

**xunorus** — [@xunorus](https://twitter.com/xunorus)

Project Link: [https://github.com/energiasonora/chatWallet](https://github.com/energiasonora/chatWallet)

Website: [https://chatwallet.org](https://chatwallet.org)
