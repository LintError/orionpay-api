# Architecture

OrionPay is composed of two runtimes that cooperate over HTTP, backed by PostgreSQL.

## Components

### 1. NestJS API (`src/`)

The primary service. Owns authentication, persistence, and payment orchestration.

| Module        | Responsibility                                                            |
| ------------- | ------------------------------------------------------------------------- |
| `auth`        | JWT issuance, multi-chain wallet-connect (nonce + signature), OTP, password reset |
| `users`       | User accounts and profiles                                                |
| `wallets`     | Wallet creation and on-chain balance synchronisation                      |
| `payments`    | Transaction orchestration: validation → fraud check → routing → broadcast |
| `blockchain`  | Provider abstraction over Stellar and EVM chains                          |
| `ai`          | Typed HTTP client for the Python AI engine (no HTTP routes of its own)    |
| `admin`       | Role-based admin API with OTP login and dashboards                        |

### 2. Python AI Engine (`ai/`)

A stateless FastAPI service exposing fraud detection, payment routing, and price
analysis. The NestJS `ai` module calls it via `AI_SERVICE_URL`.

### 3. PostgreSQL

Persists users, wallets, transactions, admins, and OTP records via TypeORM.
`synchronize` is enabled outside production; use migrations for production.

## Payment Flow

```text
POST /payments/send
      │
      ▼
1. Load source wallet, verify ownership + balance
      │
      ▼
2. Ask AI engine for optimal route  ──▶  Python: /payment-routing/analyze
      │
      ▼
3. Ask AI engine for fraud score    ──▶  Python: /fraud-detection/check
      │   (reject if is_suspicious)
      ▼
4. Persist Transaction (PROCESSING)
      │
      ▼
5. Broadcast on the chosen chain    ──▶  blockchain provider (Stellar/EVM)
      │
      ├─ success ─▶ CONFIRMED (+ txHash, confirmedAt)
      └─ failure ─▶ FAILED
```

See [`payments.service.ts`](../src/modules/payments/payments.service.ts).

## Provider Abstraction

`blockchain.service.ts` defines a single `BlockchainProvider` interface implemented by
`StellarProvider` and `EvmProvider`. Chains are registered from configuration
(`SUPPORTED_CHAINS`, `BLOCKCHAIN_RPC_URLS`), so higher layers never branch on network.

## Cross-cutting Concerns

- **Auth**: `passport-jwt` bearer strategy; `@nestjs/throttler` rate limiting (100 req/min).
- **Docs**: Swagger/OpenAPI at `/api`.
- **Config**: `@nestjs/config` global module reads from the environment.
