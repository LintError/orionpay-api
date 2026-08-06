import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../payments/entities/transaction.entity';

@Entity()
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  address: string;

  @Column()
  chain: string; // ethereum, polygon, arbitrum, etc.

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  balance: number;

  @Column()
  currency: string; // ETH, USDC, etc.

  @ManyToOne(() => User, (user) => user.wallets)
  user: User;

  @OneToMany(() => Transaction, (transaction) => transaction.fromWallet)
  sentTransactions: Transaction[];

  @OneToMany(() => Transaction, (transaction) => transaction.toWallet)
  receivedTransactions: Transaction[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
