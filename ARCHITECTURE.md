# Architecture

This document outlines the architecture for the decentralized file upload functionality.

## Components

The system is composed of four main components:

1.  **User Interface (Vanilla JS Frontend):**
    *   Runs in the user's browser.
    *   Interacts with MetaMask (or other wallet) to connect to the user's smart account.
    *   Presents storage plans to the user.
    *   Initiates subscription transactions.
    *   Uploads files to Storacha.
    *   Displays storage usage.

2.  **Smart Contract (Solidity):**
    *   Deployed on an EVM-compatible blockchain.
    *   Manages user subscriptions and payments.
    *   Accepts payments in ERC20 tokens or native currency.
    *   Emits events when a subscription is created or modified.

3.  **Backend (Node.js):**
    *   Listens for events from the smart contract.
    *   Manages a central Storacha account.
    *   Creates a separate Storacha "Space" for each user.
    *   Tracks each user's storage usage.
    *   Provides the frontend with the necessary information to interact with Storacha.
    *   Enforces quotas.

4.  **Storacha (@storacha/client):**
    *   A decentralized storage service.
    *   The backend interacts with it using the `@storacha/client` library.

## Diagram

```
+-----------------+      +----------------------+      +-----------------+
| User Interface  |----->| Smart Contract       |<-----| Backend (Node.js) |
| (Vanilla JS)    |      | (Solidity)           |      |                 |
+-----------------+      +----------------------+      +-----------------+
        ^                        |                             ^
        |                        |                             |
        | (File Upload)          | (Subscription Events)       | (Manages Spaces)
        |                        v                             |
        |              +----------------------+                |
        +------------->|   Storacha Service   |<---------------+
                       +----------------------+
```

## UX Flow

1.  The user selects a storage plan in the user interface.
2.  The user's smart account sends a transaction to the smart contract to subscribe to the plan.
3.  The smart contract processes the payment and emits a `Subscribed` event.
4.  The backend, which is listening for events from the smart contract, detects the `Subscribed` event.
5.  The backend provisions a new Storacha Space for the user.
6.  The backend confirms the provisioning to the frontend.
7.  The frontend enables the file upload functionality.
8.  The user can now upload files. The dashboard tracks usage in near-real time.
