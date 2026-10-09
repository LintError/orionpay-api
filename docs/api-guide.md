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

## Admin

### Authentication (public routes)

#### Admin login (password)

```http
POST /admin/auth/login
Content-Type: application/json

{ "email": "admin@example.com", "password": "secret" }
```

Response:
```json
{ "accessToken": "eyJhbGciOi...", "admin": { "id": "...", "email": "...", "role": "SUPER_ADMIN", "isActive": true } }
```

#### Generate OTP

```http
POST /admin/auth/otp/generate
Content-Type: application/json

{ "email": "admin@example.com" }
```

Response (development):
```json
{ "message": "OTP generated successfully", "otp": "123456" }
```

Response (production):
```json
{ "message": "OTP sent to your registered email" }
```

#### Verify OTP

```http
POST /admin/auth/otp/verify
Content-Type: application/json

{ "email": "admin@example.com", "otp": "123456" }
```

Response:
```json
{ "accessToken": "eyJhbGciOi...", "admin": { "id": "...", "email": "...", "role": "SUPER_ADMIN", "isActive": true } }
```

### Admin management (protected routes)

All routes below require `Authorization: Bearer <admin-jwt>` with `isAdmin: true`.

| Role required | Method | Endpoint | Description |
|---------------|--------|----------|-------------|
| SUPER_ADMIN   | POST   | /admin/admins | Create admin |
| SUPER_ADMIN, ADMIN | GET | /admin/admins | List admins |
| SUPER_ADMIN, ADMIN | GET | /admin/admins/:id | Get admin |
| SUPER_ADMIN   | PATCH  | /admin/admins/:id | Update admin |
| SUPER_ADMIN   | DELETE | /admin/admins/:id | Delete admin |
| SUPER_ADMIN, ADMIN, MODERATOR | GET | /admin/users | List users |
| SUPER_ADMIN, ADMIN | PATCH | /admin/users/:id/toggle-status | Toggle user status |
| SUPER_ADMIN, ADMIN, MODERATOR | GET | /admin/transactions | List all transactions |
| SUPER_ADMIN, ADMIN, MODERATOR | GET | /admin/dashboard/stats | Dashboard statistics |
