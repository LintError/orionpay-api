import { AiService } from './ai.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';

describe('AiService', () => {
  let service: AiService;
  let httpService: jest.Mocked<Pick<HttpService, 'get' | 'post'>>;

  const baseUrl = 'http://ai-engine.test/api/v1';

  beforeEach(() => {
    httpService = { get: jest.fn(), post: jest.fn() };
    const configService = {
      get: <T>(_key: string, defaultValue?: T) =>
        (baseUrl as unknown as T) ?? defaultValue,
    } as unknown as ConfigService;
    service = new AiService(
      httpService as unknown as HttpService,
      configService,
    );
  });

  const tx = {
    amount: 25,
    currency: 'XLM',
    senderAddress: 'GABC',
    recipientAddress: 'GDEST',
  };

  it('calls the fraud-detection endpoint and returns its payload', async () => {
    const payload = {
      risk_score: 0.2,
      is_suspicious: false,
      recommendations: [],
    };
    httpService.post.mockReturnValue(of({ data: payload } as any));

    const result = await service.checkFraud(tx);

    expect(httpService.post).toHaveBeenCalledWith(
      `${baseUrl}/fraud-detection/check`,
      tx,
    );
    expect(result).toEqual(payload);
  });

  it('calls the payment-routing "analyze" endpoint (matching the FastAPI route)', async () => {
    const payload = {
      optimal_route: {
        chain: 'stellar',
        fee: 0.01,
        time: 1,
        liquidity: 400000,
      },
      alternatives: [],
    };
    httpService.post.mockReturnValue(of({ data: payload } as any));

    const result = await service.getOptimalRouting(tx);

    // Regression guard: the Python engine exposes /payment-routing/analyze,
    // not /optimize. Keep these in sync.
    expect(httpService.post).toHaveBeenCalledWith(
      `${baseUrl}/payment-routing/analyze`,
      tx,
    );
    expect(result.optimal_route.chain).toBe('stellar');
  });

  it('throws a friendly error when the AI engine is unreachable', async () => {
    httpService.post.mockReturnValue(
      throwError(() => new Error('ECONNREFUSED')),
    );

    await expect(service.checkFraud(tx)).rejects.toThrow(
      'AI service unavailable',
    );
  });

  it('reports unhealthy instead of throwing when the health check fails', async () => {
    httpService.get.mockReturnValue(throwError(() => new Error('down')));

    await expect(service.getHealthCheck()).resolves.toEqual({
      status: 'unhealthy',
    });
  });
});
