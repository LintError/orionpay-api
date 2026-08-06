import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Web3 } from 'web3';
import StellarSdk from 'stellar-sdk';
const {
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Asset,
} = StellarSdk;
type StellarServer = InstanceType<typeof Horizon.Server>;

// Universal interface for all blockchain providers
interface BlockchainProvider {
  generateAddress(): Promise<{ address: string; privateKey: string }>;
  getBalance(address: string): Promise<number>;
  sendTransaction(
    fromPrivateKey: string,
    toAddress: string,
    amount: number,
  ): Promise<string>;
  verifySignature(
    message: string,
    signature: string,
    address: string,
  ): Promise<boolean>;
}

// EVM-based chains (Ethereum, Polygon, Arbitrum, Base, etc.)
class EvmProvider implements BlockchainProvider {
  constructor(private web3: Web3) {}

  async generateAddress(): Promise<{ address: string; privateKey: string }> {
    const account = this.web3.eth.accounts.create();
    return {
      address: account.address,
      privateKey: account.privateKey,
    };
  }

  async getBalance(address: string): Promise<number> {
    const balance = await this.web3.eth.getBalance(address);
    return Number(this.web3.utils.fromWei(balance, 'ether'));
  }

  async sendTransaction(
    fromPrivateKey: string,
    toAddress: string,
    amount: number,
  ): Promise<string> {
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

    const signedTx = await this.web3.eth.accounts.signTransaction(
      tx,
      fromPrivateKey,
    );
    const receipt = await this.web3.eth.sendSignedTransaction(
      signedTx.rawTransaction,
    );

    return receipt.transactionHash.toString();
  }

  async verifySignature(
    message: string,
    signature: string,
    address: string,
  ): Promise<boolean> {
    try {
      const recoveredAddress = this.web3.eth.accounts.recover(
        message,
        signature,
      );
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch {
      return false;
    }
  }
}

// Stellar blockchain provider
class StellarProvider implements BlockchainProvider {
  private server: StellarServer;

  constructor(
    horizonUrl: string,
    private isTestnet: boolean = true,
  ) {
    this.server = new Horizon.Server(horizonUrl);
  }

  async generateAddress(): Promise<{ address: string; privateKey: string }> {
    const pair = Keypair.random();
    return {
      address: pair.publicKey(),
      privateKey: pair.secret(),
    };
  }

  async getBalance(address: string): Promise<number> {
    try {
      const account = await this.server.loadAccount(address);
      const nativeBalance = account.balances.find(
        (b) => b.asset_type === 'native',
      );
      return nativeBalance ? Number(nativeBalance.balance) : 0;
    } catch {
      return 0;
    }
  }

  async sendTransaction(
    fromSecret: string,
    toAddress: string,
    amount: number,
  ): Promise<string> {
    const sourceKeypair = Keypair.fromSecret(fromSecret);
    const sourceAccount = await this.server.loadAccount(
      sourceKeypair.publicKey(),
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.isTestnet ? Networks.TESTNET : Networks.PUBLIC,
    })
      .addOperation(
        Operation.payment({
          destination: toAddress,
          asset: Asset.native(),
          amount: amount.toString(),
        }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);
    const result = await this.server.submitTransaction(transaction);
    return result.id;
  }

  async verifySignature(
    message: string,
    signature: string,
    address: string,
  ): Promise<boolean> {
    try {
      const keypair = Keypair.fromPublicKey(address);
      const messageBuffer = Buffer.from(message);
      const signatureBuffer = Buffer.from(signature, 'hex');
      return keypair.verify(messageBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }
}

@Injectable()
export class BlockchainService {
  private providers: Map<string, BlockchainProvider>;
  private chainTypeMap: Map<string, 'evm' | 'stellar' | 'solana'>;

  constructor(private configService: ConfigService) {
    this.providers = new Map();
    this.chainTypeMap = new Map();
    this.initializeProviders();
  }

  private initializeProviders() {
    const rpcUrls = new Map<string, string>();
    const blockchainUrls = this.configService
      .get<string>('BLOCKCHAIN_RPC_URLS', '')
      .split(',');
    const chainConfigs = this.configService
      .get<string>(
        'SUPPORTED_CHAINS',
        'ethereum:evm,polygon:evm,stellar:stellar',
      )
      .split(',');

    // Parse RPC URLs. Only split on the FIRST colon so the URL itself
    // (e.g. "https://horizon-testnet.stellar.org") stays intact.
    blockchainUrls.forEach((entry) => {
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex === -1) return;
      const chain = entry.slice(0, separatorIndex).trim();
      const rpcUrl = entry.slice(separatorIndex + 1).trim();
      if (chain && rpcUrl) rpcUrls.set(chain, rpcUrl);
    });

    // Initialize each chain
    chainConfigs.forEach((config) => {
      const [chain, type] = config.split(':');
      if (!chain || !type) return;

      const rpcUrl = rpcUrls.get(chain);
      if (!rpcUrl) return;

      this.chainTypeMap.set(chain, type as 'evm' | 'stellar');

      if (type === 'evm') {
        this.providers.set(chain, new EvmProvider(new Web3(rpcUrl)));
      } else if (type === 'stellar') {
        const isTestnet = this.configService.get<boolean>(
          'STELLAR_TESTNET',
          true,
        );
        this.providers.set(chain, new StellarProvider(rpcUrl, isTestnet));
      }
    });
  }

  getSupportedChains(): Array<{ chain: string; type: string }> {
    return Array.from(this.chainTypeMap.entries()).map(([chain, type]) => ({
      chain,
      type,
    }));
  }

  private getProvider(chain: string): BlockchainProvider {
    const provider = this.providers.get(chain);
    if (!provider)
      throw new Error(`No provider configured for chain: ${chain}`);
    return provider;
  }

  async generateAddress(
    chain: string,
  ): Promise<{ address: string; privateKey: string }> {
    return this.getProvider(chain).generateAddress();
  }

  async getBalance(chain: string, address: string): Promise<number> {
    return this.getProvider(chain).getBalance(address);
  }

  async sendTransaction(
    chain: string,
    fromPrivateKey: string,
    toAddress: string,
    amount: number,
  ): Promise<string> {
    return this.getProvider(chain).sendTransaction(
      fromPrivateKey,
      toAddress,
      amount,
    );
  }

  async verifySignature(
    chain: string,
    message: string,
    signature: string,
    address: string,
  ): Promise<boolean> {
    return this.getProvider(chain).verifySignature(message, signature, address);
  }
}
