"""
Payment Routing Service for OrionPay
Finds the optimal blockchain route for cross-chain payments
"""
from typing import Dict, List, Any
import heapq

class RouteOption:
    def __init__(self, chain: str, fee: float, time: int, liquidity: float):
        self.chain = chain
        self.fee = fee
        self.time = time  # minutes
        self.liquidity = liquidity
        self.score = self._calculate_score()
    
    def _calculate_score(self) -> float:
        """Calculate overall route score - lower is better"""
        # Weight factors for optimization
        fee_weight = 0.4
        time_weight = 0.3
        liquidity_weight = 0.3
        
        # Normalize factors (assuming max values)
        normalized_fee = self.fee / 100  # max fee $100
        normalized_time = self.time / 120  # max time 2 hours
        normalized_liquidity = 1 - (self.liquidity / 1000000)  # max liquidity $1M, invert so lower is better
        
        return (fee_weight * normalized_fee + 
                time_weight * normalized_time + 
                liquidity_weight * normalized_liquidity)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "chain": self.chain,
            "fee": self.fee,
            "time": self.time,
            "liquidity": self.liquidity,
            "score": self.score
        }
    
    def __lt__(self, other):
        return self.score < other.score

class PaymentRoutingService:
    def __init__(self):
        # Available blockchains with their current metrics
        self.available_chains = self._initialize_chain_metrics()
    
    def _initialize_chain_metrics(self) -> List[RouteOption]:
        """Initialize current chain metrics - would be updated in real-time"""
        return [
            RouteOption("stellar", 0.01, 1, 400000),
            RouteOption("ethereum", 15.50, 15, 500000),
            RouteOption("polygon", 0.50, 5, 250000),
            RouteOption("arbitrum", 1.20, 8, 180000),
            RouteOption("optimism", 0.80, 10, 150000),
            RouteOption("base", 0.30, 6, 100000),
            RouteOption("solana", 0.05, 3, 300000),
            RouteOption("avalanche", 1.00, 4, 200000)
        ]
    
    def find_best_routes(self, transaction: Dict[str, Any], limit: int = 3) -> List[Dict[str, Any]]:
        """
        Find the best routes for a transaction based on current chain conditions
        Returns top N sorted routes by overall score
        """
        amount = transaction.get('amount', 0)
        currency = transaction.get('currency', '')
        
        # Filter chains that have sufficient liquidity
        viable_chains = [chain for chain in self.available_chains if chain.liquidity >= amount]
        
        # If no chains have enough liquidity, return all chains with warnings
        if not viable_chains:
            viable_chains = self.available_chains
        
        # Get top N routes
        heapq.heapify(viable_chains)
        top_routes = []
        for _ in range(min(limit, len(viable_chains))):
            if viable_chains:
                top_routes.append(heapq.heappop(viable_chains).to_dict())
        
        return top_routes
    
    def update_chain_metrics(self, chain: str, new_metrics: Dict[str, float]) -> None:
        """Update chain metrics with real-time data"""
        for i, chain_option in enumerate(self.available_chains):
            if chain_option.chain == chain:
                if 'fee' in new_metrics:
                    chain_option.fee = new_metrics['fee']
                if 'time' in new_metrics:
                    chain_option.time = new_metrics['time']
                if 'liquidity' in new_metrics:
                    chain_option.liquidity = new_metrics['liquidity']
                chain_option.score = chain_option._calculate_score()
                break