# 🌌 OrionPay Backend

**AI-powered, Stellar-first multi-chain payment infrastructure.**

OrionPay is a payment backend built with **NestJS** that treats **[Stellar](https://stellar.org)** as a
first-class settlement layer while remaining multi-chain by design. A companion **Python (FastAPI)**
AI engine adds fraud scoring, price analysis, and payment-route optimisation.

> **Status:** active development. The NestJS API and the Python AI engine both run today; some services
> (e.g. real-time liquidity data) use representative sample data and are called out as such in the code.

---

## ✨ Features

- **Stellar-native payments** — generate keypairs, read balances, and submit native XLM payments on
  Stellar testnet or mainnet via Horizon (`stellar-sdk`).
- **Multi-chain by abstraction** — a single `BlockchainProvider` interface backs both Stellar and
  EVM chains (Ethereum, Polygon, …), so payments code is chain-agnostic.
- **Wallet-connect authentication** — sign-in with a Stellar/EVM wallet using a nonce + signature
  challenge, alongside classic email/password and OTP login.
- **AI-assisted routing & fraud checks** — every payment is scored for fraud and routed through the
  Python AI engine before it is broadcast.
- **Admin panel with RBAC** — role-based admin API (super-admin / admin / moderator) with OTP login,
  user management, and transaction dashboards.
- **Production hygiene** — JWT auth, per-client rate limiting, and Swagger/OpenAPI docs out of the box.

---

## 🏗️ Architecture

```text
              ┌──────────────────────────┐
   client ───▶│      NestJS API (:3000)  │
              │  auth · wallets · payments│
              │  blockchain · admin       │
              └───────┬───────────┬──────┘
                      │           │
        HTTP (REST)   │           │  provider abstraction
                      ▼           ▼
        ┌──────────────────┐   ┌────────────────────────────┐
        │ Python AI Engine │   │ Blockchain networks         │
        │ FastAPI (:8000)  │   │  • Stellar (Horizon)        │
        │ fraud · routing  │   │  • EVM (Ethereum, Polygon…) │
        │ price analysis   │   └────────────────────────────┘
        └──────────────────┘
                      │
                      ▼
             ┌─────────────────┐
             │  PostgreSQL     │
             └─────────────────┘
```

The NestJS API owns business logic and persistence; the Python engine is a stateless AI microservice
the API calls over HTTP (`AI_SERVICE_URL`).

---

## 🌟 Stellar Integration

Stellar support lives in [`src/modules/blockchain/blockchain.service.ts`](src/modules/blockchain/blockchain.service.ts)
as a `StellarProvider` implementing the shared `BlockchainProvider` interface:

| Capability          | How it works                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| Generate address    | `Keypair.random()` → public key (address) + secret                           |
| Read balance        | `server.loadAccount()` → native XLM balance from Horizon                     |
| Send payment        | `TransactionBuilder` + `Operation.payment` with `Asset.native()`, signed and submitted |
| Verify signature    | `Keypair.verify()` — powers wallet-connect authentication                    |
| Network selection   | `STELLAR_TESTNET=true` → `Networks.TESTNET`, else `Networks.PUBLIC`          |

Configure Stellar via environment variables:

```env
BLOCKCHAIN_RPC_URLS=stellar:https://horizon-testnet.stellar.org
SUPPORTED_CHAINS=stellar:stellar
STELLAR_TESTNET=true
```

Because Stellar sits behind the same interface as EVM chains, `wallets` and `payments` code never
special-cases a network — adding or removing a chain is a config change, not a code change.

---

## 🛠️ Tech Stack

| Technology       | Purpose                                   |
| ---------------- | ----------------------------------------- |
| NestJS 11        | API and business logic                    |
| TypeScript       | Application language                      |
| TypeORM + PostgreSQL | Persistence                           |
| stellar-sdk      | Stellar (Horizon) integration             |
| web3             | EVM chain integration                     |
| Passport + JWT   | Authentication                            |
| Swagger          | OpenAPI documentation                     |
| FastAPI (Python) | AI engine (fraud, routing, price)         |
| Docker Compose   | Local orchestration                       |

---

## 📂 Project Structure

```text
orionpay-backend/
├── src/
│   ├── main.ts                 # Bootstrap + Swagger setup
│   ├── app.module.ts           # Root module (config, TypeORM, throttling)
│   └── modules/
│       ├── auth/               # JWT + wallet-connect + OTP + password reset
│       ├── users/              # User accounts
│       ├── wallets/            # Wallet creation & balance sync
│       ├── payments/           # Transaction orchestration
│       ├── blockchain/         # Multi-chain provider abstraction (Stellar + EVM)
│       ├── ai/                 # HTTP client for the Python AI engine
│       └── admin/              # RBAC admin API + OTP login
├── ai/                         # Python FastAPI AI engine
│   ├── main.py                 # FastAPI entry point (:8000)
│   ├── requirements.txt
│   └── services/
│       ├── fraud_detection.py
│       ├── payment_routing.py  # includes Stellar as a route option
│       └── price_analysis.py
├── test/                       # End-to-end tests
├── docker/                     # Dockerfiles (api, ai)
├── docker-compose.yml          # Postgres + API + AI engine
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+ (for the AI engine)
- PostgreSQL 14+ (or use Docker Compose)

### Option A — Docker Compose (everything)

```bash
git clone https://github.com/OthmanImam/orionpay-backend.git
cd orionpay-backend
cp .env.example .env      # then edit values as needed
docker compose up --build
```

This starts PostgreSQL, the NestJS API (`:3000`), and the Python AI engine (`:8000`).

### Option B — Run the API locally

```bash
cp .env.example .env      # then edit values as needed
npm install
npm run start:dev
```

Then (optionally) start the AI engine in a second terminal:

```bash
cd ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API runs at `http://localhost:3000`.

---

## ⚙️ Environment Variables

All variables are documented in [`.env.example`](.env.example). Key ones:

| Variable              | Description                                              |
| --------------------- | ------------------------------------------------------- |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | PostgreSQL connection |
| `PORT`                | API port (default `3000`)                               |
| `JWT_SECRET`          | Secret used to sign JWTs — **set a strong value**       |
| `BLOCKCHAIN_RPC_URLS` | Comma-separated `chain:rpcUrl` pairs                    |
| `SUPPORTED_CHAINS`    | Comma-separated `chain:type` pairs (`type` = `stellar`/`evm`) |
| `STELLAR_TESTNET`     | `true` for testnet, `false` for public network          |
| `AI_SERVICE_URL`      | Base URL of the Python AI engine                        |

---

## 📖 API Documentation

Interactive Swagger/OpenAPI docs are served at:

```text
http://localhost:3000/api
```

### Selected endpoints

| Method | Path                          | Auth   | Description                          |
| ------ | ----------------------------- | ------ | ------------------------------------ |
| POST   | `/users`                      | —      | Register a user                      |
| POST   | `/auth/login`                 | —      | Email/password login                 |
| POST   | `/auth/wallet/nonce`          | —      | Get a nonce to sign for wallet login |
| POST   | `/auth/wallet/connect`        | —      | Verify wallet signature, issue JWT   |
| POST   | `/auth/otp/request`           | —      | Request an email OTP                 |
| GET    | `/blockchain/chains`          | JWT    | List configured chains               |
| POST   | `/wallets`                    | JWT    | Create a wallet on a chain           |
| GET    | `/wallets`                    | JWT    | List the current user's wallets      |
| POST   | `/wallets/:id/update-balance` | JWT    | Sync on-chain balance                |
| POST   | `/payments/send`              | JWT    | Initiate a payment (fraud + routing) |
| GET    | `/payments/transactions`      | JWT    | List the user's transactions         |
| GET    | `/admin/dashboard/stats`      | Admin  | Transaction dashboard stats          |

### AI Engine (FastAPI, `:8000`)

| Method | Path                             | Description                     |
| ------ | -------------------------------- | ------------------------------- |
| GET    | `/health`                        | Health check                    |
| POST   | `/api/v1/fraud-detection/check`  | Fraud risk score                |
| POST   | `/api/v1/payment-routing/analyze`| Optimal route + alternatives    |
| GET    | `/api/v1/price-analysis/{currency}` | Price analysis for a currency |

---

## 🧪 Testing

```bash
npm run test        # unit tests
npm run test:cov    # unit tests with coverage
npm run test:e2e    # end-to-end tests
```

---

## 🔒 Security

- JWT authentication (`Authorization: Bearer <token>`)
- Per-client rate limiting (`@nestjs/throttler`, 100 req/min by default)
- Role-based access control for admin routes
- AI-based fraud scoring on every payment
- Secrets are read from environment; `.env` is git-ignored (never commit real secrets)

> **Note on key custody:** private keys must be held in a secure vault/KMS in production. The current
> `payments` flow has a placeholder where the signing key is retrieved — see
> [`payments.service.ts`](src/modules/payments/payments.service.ts) — and must be wired to your key
> management before handling real funds.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[MIT](LICENSE) © OrionPay
