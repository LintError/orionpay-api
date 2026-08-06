import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    private blockchainService: BlockchainService,
  ) {}

  async createWallet(
    userId: string,
    chain: string,
    currency: string,
  ): Promise<Wallet> {
    // Generate new wallet address via blockchain service
    const { address } = await this.blockchainService.generateAddress(chain);

    const wallet = this.walletsRepository.create({
      address,
      chain,
      currency,
      user: { id: userId },
    });

    return this.walletsRepository.save(wallet);
  }

  async getUserWallets(userId: string): Promise<Wallet[]> {
    return this.walletsRepository.find({
      where: { user: { id: userId } },
      relations: ['sentTransactions', 'receivedTransactions'],
    });
  }

  async getWalletById(id: string, userId: string): Promise<Wallet | null> {
    return this.walletsRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['sentTransactions', 'receivedTransactions'],
    });
  }

  async updateBalance(walletId: string): Promise<Wallet> {
    const wallet = await this.walletsRepository.findOneBy({ id: walletId });
    if (!wallet) throw new Error('Wallet not found');

    // Fetch current on-chain balance
    const onChainBalance = await this.blockchainService.getBalance(
      wallet.chain,
      wallet.address,
    );
    wallet.balance = onChainBalance;

    return this.walletsRepository.save(wallet);
  }
}
