import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

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

@Injectable()
export class AiService {
  private aiServiceBaseUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.aiServiceBaseUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000/api/v1',
    );
  }

  async checkFraud(transaction: TransactionRequest): Promise<FraudCheckResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<FraudCheckResult>(
          `${this.aiServiceBaseUrl}/fraud-detection/check`,
          transaction,
        ),
      );
      return response.data;
    } catch (error) {
      console.error('Error calling fraud detection service:', error);
      throw new Error('AI service unavailable');
    }
  }

  async getOptimalRouting(
    transaction: TransactionRequest,
  ): Promise<RoutingResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<RoutingResult>(
          `${this.aiServiceBaseUrl}/payment-routing/analyze`,
          transaction,
        ),
      );
      return response.data;
    } catch (error) {
      console.error('Error calling payment routing service:', error);
      throw new Error('AI service unavailable');
    }
  }

  async analyzePrices(currency: string): Promise<PriceAnalysisResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<PriceAnalysisResult>(
          `${this.aiServiceBaseUrl}/price-analysis/${currency}`,
        ),
      );
      return response.data;
    } catch (error) {
      console.error('Error calling price analysis service:', error);
      throw new Error('AI service unavailable');
    }
  }

  async getHealthCheck(): Promise<{ status: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ status: string }>(
          `${this.aiServiceBaseUrl}/health`,
        ),
      );
      return response.data;
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }
}
