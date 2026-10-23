# ChatWallet

<p align="center">
  <img src="src/logoius.svg" alt="ChatWallet" width="160" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://chatwallet.org"><img src="https://img.shields.io/badge/web-chatwallet.org-blue" alt="chatwallet.org" /></a>
  <a href="https://github.com/energiasonora/chatWallet/releases/latest"><img src="https://img.shields.io/github/v/release/energiasonora/chatWallet?label=Android%20APK" alt="Latest APK" /></a>
  <a href="https://ethglobal.com/showcase/chatwallet-5rp2j"><img src="https://img.shields.io/badge/born%20at-ETHGlobal%20LFGHO%202024-6e56cf" alt="Born at ETHGlobal LFGHO 2024" /></a>
</p>

**The sovereign wallet.** Private, end-to-end encrypted chat and self-custodial crypto in one app,
for sovereign people. No KYC, no SIM, no phone number, no account, no middleman. Open source.

> If you can talk to someone, you should be able to pay them — privately, directly, with nobody in between.

- **Web:** [chatwallet.org](https://chatwallet.org) — try it in the browser at [chatwallet.org/dapp](https://chatwallet.org/dapp)
- **Android:** signed APK on [GitHub Releases](https://github.com/energiasonora/chatWallet/releases/latest) (it updates itself)
- **Manifesto:** [chatwallet.org/manifiesto](https://chatwallet.org/manifiesto)

---

## Principles

- **Your keys stay with you.** 12 words, generated and kept on your device. Nobody can freeze, recover or read your account — not even us.
- **Your conversations are yours.** Messages are end-to-end encrypted between wallets ([XMTP](https://xmtp.org)). Voice messages too, peer to peer, with no server in the middle.
- **No identity required.** An address is enough. No email, no phone, no ID.
- **Open source, verifiable.** MIT licensed; the web build is mirrored to IPFS.
- **As few servers as possible.** Where something must run (push wake-ups, encrypted backups, an IPFS node), it runs on our own box, never on a third-party service, and never sees your keys or your messages.

## What it does today

| | |
|---|---|
| **Wallet** | BIP39 self-custodial wallet, any EVM network (add your own by Chain ID), ERC-20 tokens, balances across networks in your preferred currency |
| **Monero** | Full Monero wallet running on the device (WASM). The key is derived from your same 12 words, so there is no second seed to back up. Receive, send, and pay in chat with a verifiable payment proof |
| **Private chat** | XMTP (MLS) end-to-end encryption: 1:1 and groups, voice messages, replies, reactions, read receipts |
| **Pay in chat** | Send or request payments inside the conversation, on any network, with on-chain verification on the payment card |
| **Names** | `@name` handles and ENS (`.eth`) for sending and for contacts |
| **Offline / cold mode** | Encrypted chat and air-gapped transaction signing by QR, with no internet on the signing device |
| **Sovereign backup** | Chat history encrypted with a key derived from your seed, stored on our own IPFS node; restored automatically on a new device |
| **Android app** | Native push without Google services (our own [ntfy](https://ntfy.sh) wake-up plus an on-device foreground service), in-app updates |
| **CW Connect** | Lets other apps (e.g. Soberano Mail, StealthPay) talk to your wallet over XMTP without ever touching your keys — [spec](cw-connect/SPEC.md) |

Languages: English, Español, Français.

## Run it locally

Requirements: **Node 22** and Yarn via corepack.

```bash
git clone https://github.com/energiasonora/chatWallet.git
cd chatWallet
nvm use 22
corepack enable
yarn
yarn parcel src/index.html src/dapp.html --port 7777 --https
```

Open `https://localhost:7777/dapp.html`. HTTPS is required for the camera, the microphone and the browser crypto APIs.

### Android APK

```bash
./build-apk.sh production release   # Capacitor 7; release signing needs your own keystore
```

### Tests

`tests/` holds end-to-end tests that drive a real Chrome over the DevTools protocol (two wallets chatting, payments, Monero on a local regtest node, offline mode…).

## Project layout

```
src/            web app: landing (index.html), the app (dapp.html), manifesto, book
android/        Capacitor wrapper + native plugins (push, updater, files, vibration)
monero/         Monero wallet bundle (monero-ts, WASM) loaded on demand
cw-connect/     CW Connect protocol: spec, reference module, test vectors
relay/          optional gas relayer
book-api/       Cloudflare Worker for the book that funds the project
contracts/, smartContracts/   Solidity contracts (token, presale, DID registry, experiments)
tests/          end-to-end tests
poc/, investigacion/          proofs of concept and research (payment privacy, OrbitDB, Monero measurements)
```

Release notes for users: [CHANGELOG.md](CHANGELOG.md) (shown in the app under *Novedades*).

## History

ChatWallet started as a hackathon project at **[ETHGlobal LFGHO](https://ethglobal.com/showcase/chatwallet-5rp2j)** (January 2024): a multichain hot wallet you could chat with, over XMTP. That prototype is archived at [xunorus/chatwallet](https://github.com/xunorus/chatwallet). Development continued here.

## Contributing

Issues and pull requests are welcome. For security problems, please write privately first (see Contact) instead of opening a public issue.

## License

[MIT](LICENSE).

## Contact

**xunorus** · [Energía Sonora](https://energiasonora.xyz) · [chatwallet.org](https://chatwallet.org)
