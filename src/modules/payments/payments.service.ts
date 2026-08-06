import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { WalletsService } from '../wallets/wallets.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private walletsService: WalletsService,
    private blockchainService: BlockchainService,
    private aiService: AiService,
  ) {}

  async initiateTransaction(
    userId: string,
    fromWalletId: string,
    toAddress: string,
    amount: number,
    currency: string,
  ): Promise<Transaction> {
    // Get source wallet
    const fromWallet = await this.walletsService.getWalletById(
      fromWalletId,
      userId,
    );
    if (!fromWallet) throw new Error('Source wallet not found');

    if (fromWallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Get AI recommendations for best routing and fraud check
    const routingResult = await this.aiService.getOptimalRouting({
      amount,
      currency,
      senderAddress: fromWallet.address,
      recipientAddress: toAddress,
    });

    const fraudCheck = await this.aiService.checkFraud({
      amount,
      currency,
      senderAddress: fromWallet.address,
      recipientAddress: toAddress,
    });

    if (fraudCheck.is_suspicious) {
      throw new Error('Transaction flagged as suspicious by fraud detection');
    }

    // Create transaction record
    const transaction = this.transactionsRepository.create({
      amount,
      currency,
      chain: routingResult.optimal_route.chain,
      fromWallet,
      toWallet: null, // Will be set if recipient is in our system, else leave null
      fraudRiskScore: fraudCheck.risk_score,
      routingData: routingResult,
      status: TransactionStatus.PROCESSING,
    });

    const savedTx = await this.transactionsRepository.save(transaction);

    // Execute the transaction on-chain
    try {
      const txHash = await this.blockchainService.sendTransaction(
        routingResult.optimal_route.chain,
        '', // In production, retrieve private key securely from vault,
        toAddress,
        amount,
      );

      savedTx.txHash = txHash;
      savedTx.status = TransactionStatus.CONFIRMED;
      savedTx.confirmedAt = new Date();

      return this.transactionsRepository.save(savedTx);
    } catch (error) {
      savedTx.status = TransactionStatus.FAILED;
      await this.transactionsRepository.save(savedTx);
      throw error;
    }
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.fromWallet', 'fromWallet')
      .leftJoinAndSelect('transaction.toWallet', 'toWallet')
      .where('fromWallet.userId = :userId OR toWallet.userId = :userId', {
        userId,
      })
      .orderBy('transaction.createdAt', 'DESC')
      .getMany();
  }

  async getTransactionById(
    id: string,
    userId: string,
  ): Promise<Transaction | null> {
    return this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.fromWallet', 'fromWallet')
      .leftJoinAndSelect('transaction.toWallet', 'toWallet')
      .where('transaction.id = :id', { id })
      .andWhere('fromWallet.userId = :userId OR toWallet.userId = :userId', {
        userId,
      })
      .getOne();
  }
}
