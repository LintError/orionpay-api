# API Guide

Base URL: `http://localhost:3000`
Interactive docs: `http://localhost:3000/api` (Swagger)

All protected routes require a bearer token:

```
Authorization: Bearer <jwt>
```

## Wallets

### Create a wallet

```http
POST /wallets
Authorization: Bearer <jwt>
Content-Type: application/json

{ "chain": "stellar", "currency": "XLM" }
```

Generates an on-chain address for the chain and persists the wallet. The private key is
never returned in the response.

### List my wallets

```http
GET /wallets
Authorization: Bearer <jwt>
```

### Get a wallet

```http
GET /wallets/:id
Authorization: Bearer <jwt>
```

### Sync balance from chain

```http
POST /wallets/:id/update-balance
Authorization: Bearer <jwt>
```

Reads the live balance from the chain and stores it on the wallet.

## Payments

### Send a payment

```http
POST /payments/send
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "fromWalletId": "uuid",
  "toAddress": "GDEST...",
  "amount": 25,
  "currency": "XLM"
}
```

Runs balance validation, AI routing, and a fraud check before broadcasting. Suspicious
transactions are rejected before any funds move.

### List my transactions

```http
GET /payments/transactions
Authorization: Bearer <jwt>
```

### Get a transaction

```http
GET /payments/transactions/:id
Authorization: Bearer <jwt>
```

## Blockchain

### List supported chains

```http
GET /blockchain/chains
Authorization: Bearer <jwt>
```

```json
{ "chains": [{ "chain": "stellar", "type": "stellar" }] }
```

## AI Engine

The AI endpoints are served by the Python FastAPI service (default
`http://localhost:8000/api/v1`), not the NestJS API. The NestJS `payments` module calls
them internally. See [ai-engine.md](./ai-engine.md).

| Endpoint                    | Method | Purpose                        |
| --------------------------- | ------ | ------------------------------ |
| `/fraud-detection/check`    | POST   | Risk score for a transaction   |
| `/payment-routing/analyze`  | POST   | Optimal chain/route suggestion |
| `/price-analysis/:currency` | GET    | Price trend + forecast         |
| `/health`                   | GET    | Liveness probe                 |
