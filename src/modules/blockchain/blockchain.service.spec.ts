import { BlockchainService } from './blockchain.service';
import { ConfigService } from '@nestjs/config';

/**
 * Unit tests for the multi-chain provider abstraction.
 *
 * These cover the chain-configuration parsing and provider routing logic
 * without touching the network — the Stellar/EVM SDK calls themselves are
 * exercised separately via integration tests against a live testnet.
 */
describe('BlockchainService', () => {
  function buildService(config: Record<string, any>): BlockchainService {
    const configService = {
      get: <T>(key: string, defaultValue?: T): T => {
        return (key in config ? config[key] : defaultValue) as T;
      },
    } as unknown as ConfigService;
    return new BlockchainService(configService);
  }

  it('registers Stellar and EVM chains from configuration', () => {
    const service = buildService({
      BLOCKCHAIN_RPC_URLS:
        'stellar:https://horizon-testnet.stellar.org,ethereum:https://rpc.example/eth',
      SUPPORTED_CHAINS: 'stellar:stellar,ethereum:evm',
      STELLAR_TESTNET: true,
    });

    const chains = service.getSupportedChains();

    expect(chains).toEqual(
      expect.arrayContaining([
        { chain: 'stellar', type: 'stellar' },
        { chain: 'ethereum', type: 'evm' },
      ]),
    );
    expect(chains).toHaveLength(2);
  });

  it('skips chains that have no RPC URL configured', () => {
    const service = buildService({
      // polygon is declared as supported but has no RPC URL -> skipped
      BLOCKCHAIN_RPC_URLS: 'stellar:https://horizon-testnet.stellar.org',
      SUPPORTED_CHAINS: 'stellar:stellar,polygon:evm',
      STELLAR_TESTNET: true,
    });

    const chains = service.getSupportedChains();

    expect(chains).toEqual([{ chain: 'stellar', type: 'stellar' }]);
  });

  it('generates a Stellar address that looks like a Stellar keypair', async () => {
    const service = buildService({
      BLOCKCHAIN_RPC_URLS: 'stellar:https://horizon-testnet.stellar.org',
      SUPPORTED_CHAINS: 'stellar:stellar',
      STELLAR_TESTNET: true,
    });

    const { address, privateKey } = await service.generateAddress('stellar');

    // Stellar public keys start with 'G', secret keys start with 'S'.
    expect(address).toMatch(/^G[A-Z2-7]{55}$/);
    expect(privateKey).toMatch(/^S[A-Z2-7]{55}$/);
  });

  it('throws a clear error for an unconfigured chain', async () => {
    const service = buildService({
      BLOCKCHAIN_RPC_URLS: 'stellar:https://horizon-testnet.stellar.org',
      SUPPORTED_CHAINS: 'stellar:stellar',
      STELLAR_TESTNET: true,
    });

    await expect(service.generateAddress('dogecoin')).rejects.toThrow(
      /No provider configured for chain: dogecoin/,
    );
  });

  it('falls back to the default supported chains when none are configured', () => {
    const service = buildService({
      // No SUPPORTED_CHAINS override -> default includes stellar, but no RPC
      // URLs are configured so nothing is actually registered.
      BLOCKCHAIN_RPC_URLS: '',
    });

    expect(service.getSupportedChains()).toEqual([]);
  });
});
