"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const transaction_entity_1 = require("./entities/transaction.entity");
const wallets_service_1 = require("../wallets/wallets.service");
const blockchain_service_1 = require("../blockchain/blockchain.service");
const ai_service_1 = require("../ai/ai.service");
let PaymentsService = class PaymentsService {
    transactionsRepository;
    walletsService;
    blockchainService;
    aiService;
    constructor(transactionsRepository, walletsService, blockchainService, aiService) {
        this.transactionsRepository = transactionsRepository;
        this.walletsService = walletsService;
        this.blockchainService = blockchainService;
        this.aiService = aiService;
    }
    async initiateTransaction(userId, fromWalletId, toAddress, amount, currency) {
        const fromWallet = await this.walletsService.getWalletById(fromWalletId, userId);
        if (!fromWallet)
            throw new Error('Source wallet not found');
        if (fromWallet.balance < amount) {
            throw new Error('Insufficient balance');
        }
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
        const transaction = this.transactionsRepository.create({
            amount,
            currency,
            chain: routingResult.optimal_route.chain,
            fromWallet,
            toWallet: null,
            fraudRiskScore: fraudCheck.risk_score,
            routingData: routingResult,
            status: transaction_entity_1.TransactionStatus.PROCESSING,
        });
        const savedTx = await this.transactionsRepository.save(transaction);
        try {
            const txHash = await this.blockchainService.sendTransaction(routingResult.optimal_route.chain, '', toAddress, amount);
            savedTx.txHash = txHash;
            savedTx.status = transaction_entity_1.TransactionStatus.CONFIRMED;
            savedTx.confirmedAt = new Date();
            return this.transactionsRepository.save(savedTx);
        }
        catch (error) {
            savedTx.status = transaction_entity_1.TransactionStatus.FAILED;
            await this.transactionsRepository.save(savedTx);
            throw error;
        }
    }
    async getUserTransactions(userId) {
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
    async getTransactionById(id, userId) {
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
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        wallets_service_1.WalletsService,
        blockchain_service_1.BlockchainService,
        ai_service_1.AiService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map