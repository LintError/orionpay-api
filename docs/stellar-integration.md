# Stellar Integration

Stellar is OrionPay's primary settlement network. This document describes how the
integration works and how to configure it.

## Overview

Stellar support lives in [`blockchain.service.ts`](../src/modules/blockchain/blockchain.service.ts)
as the `StellarProvider` class, which implements the shared `BlockchainProvider`
interface. It uses the official [`stellar-sdk`](https://www.npmjs.com/package/stellar-sdk)
and talks to a Horizon server.

## Configuration

```env
# Register Stellar as a supported chain
SUPPORTED_CHAINS=stellar:stellar

# Point it at a Horizon server (note: only the FIRST colon is treated as the
# chain/URL separator, so the https:// in the URL is preserved)
BLOCKCHAIN_RPC_URLS=stellar:https://horizon-testnet.stellar.org

# Testnet vs public network passphrase
STELLAR_TESTNET=true
```

For mainnet:

```env
BLOCKCHAIN_RPC_URLS=stellar:https://horizon.stellar.org
STELLAR_TESTNET=false
```

## What the provider does

| Operation         | Implementation                                                              |
| ----------------- | --------------------------------------------------------------------------- |
| `generateAddress` | `Keypair.random()` → returns public key (address) and secret key            |
| `getBalance`      | `server.loadAccount(address)` → native (XLM) balance, `0` if account unfunded |
| `sendTransaction` | Builds a `payment` operation with `Asset.native()`, signs, and submits      |
| `verifySignature` | `Keypair.verify()` against a hex-encoded signature                          |

## Key facts about Stellar

- **Keys**: Stellar uses ed25519 public/secret key pairs. Addresses start with `G`,
  secrets start with `S`.
- **Account activation**: A Stellar account must be funded with a minimum balance before
  it exists on the ledger. `getBalance` returns `0` for unfunded accounts rather than
  throwing.
- **Base fee**: Transactions use `BASE_FEE` (100 stroops). One XLM = 10,000,000 stroops.
- **Network passphrase**: Testnet and public use different passphrases; signing against
  the wrong one produces an invalid transaction. Controlled by `STELLAR_TESTNET`.

## Testing on testnet

1. Generate an address (create a wallet via the API, or `Keypair.random()`).
2. Fund it with the [Friendbot](https://friendbot.stellar.org/?addr=YOUR_ADDRESS).
3. Sync the balance: `POST /wallets/:id/update-balance`.
4. Send a payment to another funded testnet address.

## Security note

Key custody is deliberately **not** wired up yet. When a wallet is created, the generated
secret is returned by the provider but **not persisted** — [`wallets.service.ts`](../src/modules/wallets/wallets.service.ts)
stores only the address. Consequently the payment broadcast path in
[`payments.service.ts`](../src/modules/payments/payments.service.ts) passes an empty
placeholder where the signing key belongs, so on-chain submission is a stub pending a
real key-management integration.

For production, wire signing to a KMS/HSM or a non-custodial flow so secrets never touch
the application database. Read/verify operations (`getBalance`, `generateAddress`,
`verifySignature`) are fully functional today. See the roadmap in the main
[README](../README.md).
