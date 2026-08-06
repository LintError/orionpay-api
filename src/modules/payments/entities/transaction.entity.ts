import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Wallet } from '../../wallets/entities/wallet.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column()
  currency: string;

  @Column()
  chain: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ nullable: true })
  txHash: string; // On-chain transaction hash

  @ManyToOne(() => Wallet, (wallet) => wallet.sentTransactions)
  fromWallet: Wallet;

  @ManyToOne(() => Wallet, (wallet) => wallet.receivedTransactions, {
    nullable: true,
  })
  toWallet: Wallet | null;

  @Column('float', { nullable: true })
  fraudRiskScore: number;

  @Column({ type: 'jsonb', nullable: true })
  routingData: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;
}
