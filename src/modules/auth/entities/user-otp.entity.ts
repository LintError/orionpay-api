import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OtpRequestStatus } from '../enums/otp-request-status.enum';

@Entity()
export class UserOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  otp: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  isUsed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({
    type: 'enum',
    enum: OtpRequestStatus,
    default: OtpRequestStatus.PENDING,
  })
  status: OtpRequestStatus;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: false })
  isPasswordReset: boolean;

  @Column({ nullable: true })
  resetToken: string;
}
