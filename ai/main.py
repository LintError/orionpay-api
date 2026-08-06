"""
OrionPay Python AI Engine - Main FastAPI entry point
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

# Import AI services
from services.fraud_detection import FraudDetectionService
from services.price_analysis import PriceAnalysisService
from services.payment_routing import PaymentRoutingService

app = FastAPI(title="OrionPay AI Engine", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI services
fraud_detection = FraudDetectionService()
price_analysis = PriceAnalysisService()
payment_routing = PaymentRoutingService()

class TransactionRequest(BaseModel):
    amount: float
    currency: str
    sender_address: str
    recipient_address: str
    metadata: Dict[str, Any] = {}

@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "OrionPay AI Engine"}

@app.post("/api/v1/fraud-detection/check")
async def check_fraud(transaction: TransactionRequest):
    """Analyze transaction for potential fraud"""
    try:
        risk_score = fraud_detection.analyze(transaction.dict())
        return {
            "risk_score": risk_score,
            "is_suspicious": risk_score > 0.7,
            "recommendations": fraud_detection.get_recommendations(risk_score)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/payment-routing/analyze")
async def analyze_routing(transaction: TransactionRequest):
    """Find optimal payment routing for transaction"""
    try:
        routes = payment_routing.find_best_routes(transaction.dict())
        return {"optimal_route": routes[0] if routes else None, "alternatives": routes[1:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/price-analysis/{currency}")
async def get_price_analysis(currency: str):
    """Get price analysis for a specific currency"""
    try:
        analysis = price_analysis.analyze(currency)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)