import { PaymentsService } from './payments.service';
import { WalletsService } from '../wallets/wallets.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AiService } from '../ai/ai.service';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus } from './entities/transaction.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let txRepo: jest.Mocked<Pick<Repository<Transaction>, 'create' | 'save'>>;
  let walletsService: jest.Mocked<Pick<WalletsService, 'getWalletById'>>;
  let blockchainService: jest.Mocked<
    Pick<BlockchainService, 'sendTransaction'>
  >;
  let aiService: jest.Mocked<
    Pick<AiService, 'getOptimalRouting' | 'checkFraud'>
  >;

  const wallet = { id: 'w1', address: 'GABC...STELLAR', balance: 100 };

  beforeEach(() => {
    txRepo = {
      create: jest.fn().mockImplementation((data) => data as Transaction),
      save: jest
        .fn()
        .mockImplementation((tx) => Promise.resolve(tx as Transaction)),
    };
    walletsService = { getWalletById: jest.fn() };
    blockchainService = { sendTransaction: jest.fn() };
    aiService = { getOptimalRouting: jest.fn(), checkFraud: jest.fn() };

    service = new PaymentsService(
      txRepo as unknown as Repository<Transaction>,
      walletsService as unknown as WalletsService,
      blockchainService as unknown as BlockchainService,
      aiService as unknown as AiService,
    );
  });

  function happyPathMocks() {
    walletsService.getWalletById.mockResolvedValue(wallet as any);
    aiService.getOptimalRouting.mockResolvedValue({
      optimal_route: {
        chain: 'stellar',
        fee: 0.01,
        time: 1,
        liquidity: 400000,
      },
      alternatives: [],
    });
    aiService.checkFraud.mockResolvedValue({
      risk_score: 0.1,
      is_suspicious: false,
      recommendations: [],
    });
    blockchainService.sendTransaction.mockResolvedValue('stellar-tx-hash');
  }

  it('confirms a valid transaction and records the on-chain hash', async () => {
    happyPathMocks();

    const result = await service.initiateTransaction(
      'user-1',
      'w1',
      'GDEST...',
      25,
      'XLM',
    );

    expect(blockchainService.sendTransaction).toHaveBeenCalledWith(
      'stellar',
      expect.any(String),
      'GDEST...',
      25,
    );
    expect(result.status).toBe(TransactionStatus.CONFIRMED);
    expect(result.txHash).toBe('stellar-tx-hash');
    expect(result.confirmedAt).toBeInstanceOf(Date);
  });

  it('routes the payment onto the chain chosen by the AI engine', async () => {
    happyPathMocks();
    aiService.getOptimalRouting.mockResolvedValue({
      optimal_route: { chain: 'polygon', fee: 0.5, time: 5, liquidity: 250000 },
      alternatives: [],
    });

    await service.initiateTransaction('user-1', 'w1', '0xDEST', 25, 'USDC');

    expect(blockchainService.sendTransaction).toHaveBeenCalledWith(
      'polygon',
      expect.any(String),
      '0xDEST',
      25,
    );
  });

  it('rejects when the source wallet is missing', async () => {
    walletsService.getWalletById.mockResolvedValue(null);

    await expect(
      service.initiateTransaction('user-1', 'missing', 'GDEST...', 25, 'XLM'),
    ).rejects.toThrow('Source wallet not found');
  });

  it('rejects when the balance is insufficient', async () => {
    walletsService.getWalletById.mockResolvedValue({
      ...wallet,
      balance: 10,
    } as any);

    await expect(
      service.initiateTransaction('user-1', 'w1', 'GDEST...', 25, 'XLM'),
    ).rejects.toThrow('Insufficient balance');
  });

  it('rejects a transaction flagged as suspicious by fraud detection', async () => {
    walletsService.getWalletById.mockResolvedValue(wallet as any);
    aiService.getOptimalRouting.mockResolvedValue({
      optimal_route: {
        chain: 'stellar',
        fee: 0.01,
        time: 1,
        liquidity: 400000,
      },
      alternatives: [],
    });
    aiService.checkFraud.mockResolvedValue({
      risk_score: 0.95,
      is_suspicious: true,
      recommendations: ['manual review'],
    });

    await expect(
      service.initiateTransaction('user-1', 'w1', 'GDEST...', 25, 'XLM'),
    ).rejects.toThrow('flagged as suspicious');
    expect(blockchainService.sendTransaction).not.toHaveBeenCalled();
  });

  it('marks the transaction FAILED when the on-chain broadcast throws', async () => {
    happyPathMocks();
    blockchainService.sendTransaction.mockRejectedValue(
      new Error('network down'),
    );

    await expect(
      service.initiateTransaction('user-1', 'w1', 'GDEST...', 25, 'XLM'),
    ).rejects.toThrow('network down');

    // Last save should have persisted the FAILED status.
    const savedStatuses = txRepo.save.mock.calls.map(
      ([tx]) => (tx as Transaction).status,
    );
    expect(savedStatuses).toContain(TransactionStatus.FAILED);
  });
});
