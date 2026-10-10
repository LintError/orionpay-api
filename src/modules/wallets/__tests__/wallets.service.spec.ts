import { Test, TestingModule } from '@nestjs/testing';
import { WalletsService } from '../wallets.service';
import { BlockchainService, BlockchainProviderUnavailableError } from '../blockchain/blockchain.service';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('WalletsService', () => {
  let service: WalletsService;
  let walletsRepository: jest.Mocked<Repository<Wallet>>;
  let blockchainService: jest.Mocked<BlockchainService>;

  const mockWallet = {
    id: 'wallet-123',
    address: 'GTESTADDRESS',
    chain: 'stellar',
    currency: 'XLM',
    balance: 100,
    user: { id: 'user-123' },
  } as Wallet;

  beforeEach(async () => {
    walletsRepository = {
      findOneBy: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<Repository<Wallet>>;

    blockchainService = {
      getBalance: jest.fn(),
      generateAddress: jest.fn(),
    } as unknown as jest.Mocked<BlockchainService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: getRepositoryToken(Wallet), useValue: walletsRepository },
        { provide: BlockchainService, useValue: blockchainService },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  describe('updateBalance', () => {
    it('should update and return wallet with new balance on success', async () => {
      walletsRepository.findOneBy.mockResolvedValue(mockWallet);
      blockchainService.getBalance.mockResolvedValue(250.75);
      walletsRepository.save.mockResolvedValue({ ...mockWallet, balance: 250.75 });

      const result = await service.updateBalance('wallet-123');

      expect(result.balance).toBe(250.75);
      expect(blockchainService.getBalance).toHaveBeenCalledWith('stellar', 'GTESTADDRESS');
    });

    it('should throw BlockchainProviderUnavailableError and not update balance when provider fails', async () => {
      walletsRepository.findOneBy.mockResolvedValue(mockWallet);
      const error = new BlockchainProviderUnavailableError(
        'Stellar balance lookup failed',
        'stellar',
        'GTESTADDRESS',
        new Error('network error'),
      );
      blockchainService.getBalance.mockRejectedValue(error);
      walletsRepository.save.mockResolvedValue(mockWallet); // Should not be called

      await expect(service.updateBalance('wallet-123')).rejects.toThrow(
        BlockchainProviderUnavailableError,
      );

      expect(walletsRepository.save).not.toHaveBeenCalled();
    });

    it('should re-throw other errors', async () => {
      walletsRepository.findOneBy.mockResolvedValue(mockWallet);
      blockchainService.getBalance.mockRejectedValue(new Error('some other error'));

      await expect(() => service.updateBalance('wallet-123')).rejects.toThrow('some other error');
    });

    it('should throw when wallet not found', async () => {
      walletsRepository.findOneBy.mockResolvedValue(null);

      await expect(() => service.updateBalance('nonexistent')).rejects.toThrow('Wallet not found');
    });
  });
});