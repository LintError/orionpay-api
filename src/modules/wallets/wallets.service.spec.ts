import { WalletsService } from './wallets.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';

describe('WalletsService', () => {
  let service: WalletsService;
  let walletsRepository: jest.Mocked<
    Pick<
      Repository<Wallet>,
      'create' | 'save' | 'find' | 'findOne' | 'findOneBy'
    >
  >;
  let blockchainService: jest.Mocked<
    Pick<BlockchainService, 'generateAddress' | 'getBalance'>
  >;

  beforeEach(() => {
    walletsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
    };
    blockchainService = {
      generateAddress: jest.fn(),
      getBalance: jest.fn(),
    };
    service = new WalletsService(
      walletsRepository as unknown as Repository<Wallet>,
      blockchainService as unknown as BlockchainService,
    );
  });

  describe('createWallet', () => {
    it('generates an on-chain address and persists the wallet', async () => {
      blockchainService.generateAddress.mockResolvedValue({
        address: 'GABC...STELLAR',
        privateKey: 'SABC...SECRET',
      });
      const built = {
        address: 'GABC...STELLAR',
        chain: 'stellar',
        currency: 'XLM',
      } as Wallet;
      walletsRepository.create.mockReturnValue(built);
      walletsRepository.save.mockResolvedValue({
        id: 'w1',
        ...built,
      });

      const result = await service.createWallet('user-1', 'stellar', 'XLM');

      expect(blockchainService.generateAddress).toHaveBeenCalledWith('stellar');
      expect(walletsRepository.create).toHaveBeenCalledWith({
        address: 'GABC...STELLAR',
        chain: 'stellar',
        currency: 'XLM',
        user: { id: 'user-1' },
      });
      expect(result.id).toBe('w1');
    });

    it('does not persist the private key on the wallet record', async () => {
      blockchainService.generateAddress.mockResolvedValue({
        address: 'GABC...STELLAR',
        privateKey: 'SABC...SECRET',
      });
      walletsRepository.create.mockReturnValue({} as Wallet);
      walletsRepository.save.mockResolvedValue({} as Wallet);

      await service.createWallet('user-1', 'stellar', 'XLM');

      const createArg = walletsRepository.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(createArg).not.toHaveProperty('privateKey');
    });
  });

  describe('updateBalance', () => {
    it('syncs the wallet balance from the chain', async () => {
      walletsRepository.findOneBy.mockResolvedValue({
        id: 'w1',
        chain: 'stellar',
        address: 'GABC...STELLAR',
        balance: 0,
      } as Wallet);
      blockchainService.getBalance.mockResolvedValue(42.5);
      walletsRepository.save.mockImplementation((w) =>
        Promise.resolve(w as Wallet),
      );

      const result = await service.updateBalance('w1');

      expect(blockchainService.getBalance).toHaveBeenCalledWith(
        'stellar',
        'GABC...STELLAR',
      );
      expect(result.balance).toBe(42.5);
    });

    it('throws when the wallet does not exist', async () => {
      walletsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.updateBalance('missing')).rejects.toThrow(
        'Wallet not found',
      );
    });
  });
});
