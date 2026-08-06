# AI Engine

The AI engine is a standalone [FastAPI](https://fastapi.tiangolo.com/) service in
[`ai/`](../ai/). It exposes three analysis capabilities that the NestJS API consumes over
HTTP. It is stateless and holds no database connection.

## Running it

```bash
cd ai
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Or via Docker Compose (`docker compose up ai`). The NestJS side reaches it through
`AI_SERVICE_URL` (default `http://localhost:8000/api/v1`).

## Services

### Fraud detection — `POST /fraud-detection/check`

[`fraud_detection.py`](../ai/services/fraud_detection.py) uses a scikit-learn
`IsolationForest` anomaly detector. It extracts features (amount, address lengths, and
room for more) from the transaction, scores it, and normalises to a `0–1` risk value.
Higher means riskier. `get_recommendations` maps the score to actions
(approve → monitor → manual review → block).

### Payment routing — `POST /payment-routing/analyze`

[`payment_routing.py`](../ai/services/payment_routing.py) suggests an optimal chain/route
for a transfer, weighing fee, settlement time, and liquidity. Returns an `optimal_route`
plus `alternatives`.

### Price analysis — `GET /price-analysis/:currency`

[`price_analysis.py`](../ai/services/price_analysis.py) fits a `LinearRegression` model
per currency and returns the current price, weekly/monthly change, a 7-day forecast, and
human-readable insights (trend, volatility, execution timing).

### Health — `GET /health`

Liveness probe. The NestJS `AiService.getHealthCheck()` reports `unhealthy` rather than
throwing when this is unreachable, so a down AI engine degrades gracefully.

## Important: sample data

The models are trained on **synthetic/sample data**, not live market or transaction
feeds:

- Fraud detection fits on `np.random.randn(1000, 10)` at startup.
- Price analysis seeds 30 days of random-walk history from hardcoded base prices.

This makes the engine fully runnable offline for demos and tests, but the scores and
forecasts are **illustrative**. Wiring real data sources (transaction history, market
APIs) is on the roadmap — see the main [README](../README.md).

## How NestJS calls it

[`ai.service.ts`](../src/modules/ai/ai.service.ts) is a thin typed client. Note the route
names must stay in sync with the FastAPI routes — routing is `/payment-routing/analyze`
(not `/optimize`); a regression test guards this in
[`ai.service.spec.ts`](../src/modules/ai/ai.service.spec.ts).
