import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
interface TransactionRequest {
    amount: number;
    currency: string;
    senderAddress: string;
    recipientAddress: string;
}
interface FraudCheckResult {
    risk_score: number;
    is_suspicious: boolean;
    recommendations: string[];
}
interface RoutingResult {
    optimal_route: {
        chain: string;
        fee: number;
        time: number;
        liquidity: number;
    };
    alternatives: any[];
}
interface PriceAnalysisResult {
    currency: string;
    current_price_usd: number;
    weekly_change_percent: number;
    monthly_change_percent: number;
    '7day_forecast': number[];
    insights: string[];
}
export declare class AiService {
    private httpService;
    private configService;
    private aiServiceBaseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    checkFraud(transaction: TransactionRequest): Promise<FraudCheckResult>;
    getOptimalRouting(transaction: TransactionRequest): Promise<RoutingResult>;
    analyzePrices(currency: string): Promise<PriceAnalysisResult>;
    getHealthCheck(): Promise<{
        status: string;
    }>;
}
export {};
