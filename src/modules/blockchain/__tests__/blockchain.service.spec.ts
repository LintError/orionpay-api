import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService, BlockchainProviderUnavailableError } from '../blockchain.service';
import { ConfigService } from '@nestjs/config';
import StellarSdk from 'stellar-sdk';

describe('BlockchainService', () => {
  let service: BlockchainService;
  let configService: jest.Mocked<ConfigService>;

  const mockLoadAccount = jest.fn();
  const mockSubmitTransaction = jest.fn();

  jest.mock('stellar-sdk', () => {
    const original = jest.requireActual('stellar-sdk');
    return {
      ...original,
      Horizon: {
        ...original.Horizon,
        Server: jest.fn().mockImplementation(() => ({
          loadAccount: mockLoadAccount,
          submitTransaction: mockSubmitTransaction,
        })),
      },
    };
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn(),
    } as any;

    configService.get.mockImplementation((key: string) => {
      if (key === 'BLOCKCHAIN_RPC_URLS') {
        return 'stellar:https://horizon-testnet.stellar.org';
      }
      if (key === 'SUPPORTED_CHAINS') {
        return 'stellar:stellar';
      }
      if (key === 'STELLAR_TESTNET') {
        return true;
      }
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
  });

  describe('getBalance', () => {
    it('should return the native balance on success', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'native', balance: '100.5' },
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', balance: '500' },
        ],
      });

      const balance = await service.getBalance('stellar', 'GTESTADDRESS123');

      expect(balance).toBe(100.5);
      expect(mockLoadAccount).toHaveBeenCalledWith('GTESTADDRESS123');
    });

    it('should return 0 when account has no native balance', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', balance: '500' },
        ],
      });

      const balance = await service.getBalance('stellar', 'GTESTADDRESS123');

      expect(balance).toBe(0);
    });

    it('should return 0 when account is not found (404)', async () => {
      const error = new Error('Not Found');
      (error as any).response = { status: 404 };
      mockLoadAccount.mockRejectedValue(error);

      const balance = await service.getBalance('stellar', 'GUNFUNDEDADDRESS');

      expect(balance).toBe(0);
    });

    it('should throw BlockchainProviderUnavailableError on network error', async () => {
      const error = new Error('Network error');
      (error as any).response = { status: 500 };
      mockLoadAccount.mockRejectedValue(error);

      await expect(
        service.getBalance('stellar', 'GTESTADDRESS123'),
      ).rejects.toThrow(BlockchainProviderUnavailableError);

      await expect(
        service.getBalance('stellar', 'GTESTADDRESS123'),
      ).rejects.toMatchObject({
        chain: 'stellar',
        address: 'GTESTADDRESS123',
      });
    });

    it('should throw BlockchainProviderUnavailableError on rate limit (429)', async () => {
      const error = new Error('Rate limited');
      (error as any).response = { status: 429 };
      mockLoadAccount.mockRejectedValue(error);

      await expect(
        service.getBalance('stellar', 'GTESTADDRESS123'),
      ).rejects.toThrow(BlockchainProviderUnavailableError);
    });

    it('should throw BlockchainProviderUnavailableError on timeout', async () => {
      const error = new Error('ETIMEDOUT');
      (error as any).code = 'ETIMEDOUT';
      mockLoadAccount.mockRejectedValue(error);

      await expect(
        service.getBalance('stellar', 'GTESTADDRESS123'),
      ).rejects.toThrow(BlockchainProviderUnavailableError);
    });
  });

  describe('generateAddress', () => {
    it('should generate a new Stellar address', async () => {
      const result = await service.generateAddress('stellar');

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('privateKey');
      expect(result.address).toMatch(/^G/);
      expect(result.privateKey).toMatch(/^S/);
    });
  });

  describe('BlockchainProviderUnavailableError', () => {
    it('should expose chain and address properties', () => {
      const error = new BlockchainProviderUnavailableError(
        'Test error',
        'stellar',
        'GTESTADDRESS',
        new Error('cause'),
      );

      expect(error.chain).toBe('stellar');
      expect(error.address).toBe('GTESTADDRESS');
      expect(error.cause).toBeInstanceOf(Error);
    });
  });
});