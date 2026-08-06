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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const web3_1 = require("web3");
const stellar_sdk_1 = __importDefault(require("stellar-sdk"));
const { Horizon, Keypair, Networks, TransactionBuilder, Operation, BASE_FEE, Asset, } = stellar_sdk_1.default;
class EvmProvider {
    web3;
    constructor(web3) {
        this.web3 = web3;
    }
    async generateAddress() {
        const account = this.web3.eth.accounts.create();
        return {
            address: account.address,
            privateKey: account.privateKey,
        };
    }
    async getBalance(address) {
        const balance = await this.web3.eth.getBalance(address);
        return Number(this.web3.utils.fromWei(balance, 'ether'));
    }
    async sendTransaction(fromPrivateKey, toAddress, amount) {
        const account = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
        const fromAddress = account.address;
        const value = this.web3.utils.toWei(amount.toString(), 'ether');
        const gasPrice = await this.web3.eth.getGasPrice();
        const tx = {
            from: fromAddress,
            to: toAddress,
            value,
            gas: 21000,
            gasPrice,
        };
        const signedTx = await this.web3.eth.accounts.signTransaction(tx, fromPrivateKey);
        const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        return receipt.transactionHash.toString();
    }
    async verifySignature(message, signature, address) {
        try {
            const recoveredAddress = this.web3.eth.accounts.recover(message, signature);
            return recoveredAddress.toLowerCase() === address.toLowerCase();
        }
        catch {
            return false;
        }
    }
}
class StellarProvider {
    isTestnet;
    server;
    constructor(horizonUrl, isTestnet = true) {
        this.isTestnet = isTestnet;
        this.server = new Horizon.Server(horizonUrl);
    }
    async generateAddress() {
        const pair = Keypair.random();
        return {
            address: pair.publicKey(),
            privateKey: pair.secret(),
        };
    }
    async getBalance(address) {
        try {
            const account = await this.server.loadAccount(address);
            const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
            return nativeBalance ? Number(nativeBalance.balance) : 0;
        }
        catch {
            return 0;
        }
    }
    async sendTransaction(fromSecret, toAddress, amount) {
        const sourceKeypair = Keypair.fromSecret(fromSecret);
        const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());
        const transaction = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase: this.isTestnet ? Networks.TESTNET : Networks.PUBLIC,
        })
            .addOperation(Operation.payment({
            destination: toAddress,
            asset: Asset.native(),
            amount: amount.toString(),
        }))
            .setTimeout(30)
            .build();
        transaction.sign(sourceKeypair);
        const result = await this.server.submitTransaction(transaction);
        return result.id;
    }
    async verifySignature(message, signature, address) {
        try {
            const keypair = Keypair.fromPublicKey(address);
            const messageBuffer = Buffer.from(message);
            const signatureBuffer = Buffer.from(signature, 'hex');
            return keypair.verify(messageBuffer, signatureBuffer);
        }
        catch {
            return false;
        }
    }
}
let BlockchainService = class BlockchainService {
    configService;
    providers;
    chainTypeMap;
    constructor(configService) {
        this.configService = configService;
        this.providers = new Map();
        this.chainTypeMap = new Map();
        this.initializeProviders();
    }
    initializeProviders() {
        const rpcUrls = new Map();
        const blockchainUrls = this.configService
            .get('BLOCKCHAIN_RPC_URLS', '')
            .split(',');
        const chainConfigs = this.configService
            .get('SUPPORTED_CHAINS', 'ethereum:evm,polygon:evm,stellar:stellar')
            .split(',');
        blockchainUrls.forEach((entry) => {
            const separatorIndex = entry.indexOf(':');
            if (separatorIndex === -1)
                return;
            const chain = entry.slice(0, separatorIndex).trim();
            const rpcUrl = entry.slice(separatorIndex + 1).trim();
            if (chain && rpcUrl)
                rpcUrls.set(chain, rpcUrl);
        });
        chainConfigs.forEach((config) => {
            const [chain, type] = config.split(':');
            if (!chain || !type)
                return;
            const rpcUrl = rpcUrls.get(chain);
            if (!rpcUrl)
                return;
            this.chainTypeMap.set(chain, type);
            if (type === 'evm') {
                this.providers.set(chain, new EvmProvider(new web3_1.Web3(rpcUrl)));
            }
            else if (type === 'stellar') {
                const isTestnet = this.configService.get('STELLAR_TESTNET', true);
                this.providers.set(chain, new StellarProvider(rpcUrl, isTestnet));
            }
        });
    }
    getSupportedChains() {
        return Array.from(this.chainTypeMap.entries()).map(([chain, type]) => ({
            chain,
            type,
        }));
    }
    getProvider(chain) {
        const provider = this.providers.get(chain);
        if (!provider)
            throw new Error(`No provider configured for chain: ${chain}`);
        return provider;
    }
    async generateAddress(chain) {
        return this.getProvider(chain).generateAddress();
    }
    async getBalance(chain, address) {
        return this.getProvider(chain).getBalance(address);
    }
    async sendTransaction(chain, fromPrivateKey, toAddress, amount) {
        return this.getProvider(chain).sendTransaction(fromPrivateKey, toAddress, amount);
    }
    async verifySignature(chain, message, signature, address) {
        return this.getProvider(chain).verifySignature(message, signature, address);
    }
};
exports.BlockchainService = BlockchainService;
exports.BlockchainService = BlockchainService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BlockchainService);
//# sourceMappingURL=blockchain.service.js.map