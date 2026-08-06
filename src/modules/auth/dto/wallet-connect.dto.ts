export class WalletConnectDto {
  walletAddress: string;
  chain: string;
  signature: string;
  message: string;
  nonce: string;
}

export class GenerateNonceDto {
  walletAddress: string;
  chain: string;
}

export class WalletAuthResponse {
  access_token: string;
  user: {
    id: string;
    walletAddress: string;
    chain: string;
    isNewUser: boolean;
  };
}
