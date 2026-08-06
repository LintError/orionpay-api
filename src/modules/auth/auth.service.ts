import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { UserOtp } from './entities/user-otp.entity';
import { OtpRequestStatus } from './enums/otp-request-status.enum';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { randomInt, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private blockchainService: BlockchainService,
    @InjectRepository(UserOtp)
    private readonly userOtpRepository: Repository<UserOtp>,
  ) {}

  /**
   * User requests an OTP - creates a pending request
   * OTP will be processed and sent by the cron job
   */
  async requestUserOtp(
    email: string,
  ): Promise<{ message: string; requestId: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Create pending OTP request
    const userOtp = this.userOtpRepository.create({
      userId: user.id,
      status: OtpRequestStatus.PENDING,
    });

    await this.userOtpRepository.save(userOtp);
    return {
      message: 'OTP request submitted. You will receive your OTP shortly.',
      requestId: userOtp.id,
    };
  }

  /**
   * Verify user's OTP - works after cron job has processed the request and set the OTP
   */
  async verifyUserOtp(
    email: string,
    otp: string,
  ): Promise<{ accessToken: string; user: any }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Find valid OTP that has been processed
    const validOtp = await this.userOtpRepository.findOne({
      where: {
        userId: user.id,
        otp,
        isUsed: false,
        status: OtpRequestStatus.PROCESSED,
      },
    });

    if (!validOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Check if OTP has expired
    if (new Date() > validOtp.expiresAt) {
      await this.userOtpRepository.update(validOtp.id, {
        isUsed: true,
        status: OtpRequestStatus.EXPIRED,
      });
      throw new UnauthorizedException('OTP has expired');
    }

    // Mark OTP as used
    await this.userOtpRepository.update(validOtp.id, { isUsed: true });

    // Update last login timestamp
    await this.usersService.updateLastLogin(user.id);

    // Generate JWT
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    const { password, ...result } = user;
    return { accessToken, user: result };
  }

  /**
   * Cron job that runs every 30 seconds to process pending OTP requests
   * Generates OTPs and marks them as ready for use
   * In production, this would also send the OTP via email/SMS
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingOtpRequests() {
    const pendingOtps = await this.userOtpRepository.find({
      where: { status: OtpRequestStatus.PENDING },
      relations: ['user'],
    });

    if (pendingOtps.length === 0) {
      return;
    }

    console.log(
      `[OTP Cron] Processing ${pendingOtps.length} pending OTP requests`,
    );

    for (const pendingOtp of pendingOtps) {
      try {
        // Mark as processing
        await this.userOtpRepository.update(pendingOtp.id, {
          status: OtpRequestStatus.PROCESSING,
        });

        // Invalidate any existing unused OTPs for this user
        await this.userOtpRepository.update(
          { userId: pendingOtp.userId, isUsed: false, id: Not(pendingOtp.id) },
          { isUsed: true, status: OtpRequestStatus.EXPIRED },
        );

        // Generate 6-digit OTP
        const otp = randomInt(100000, 999999).toString();

        // Set expiration to 15 minutes from now
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        // Update the OTP record with generated values
        await this.userOtpRepository.update(pendingOtp.id, {
          otp,
          expiresAt,
          isUsed: false,
          status: OtpRequestStatus.PROCESSED,
          processedAt: new Date(),
        });

        // In a real production environment, you would send the OTP here:
        // await this.emailService.sendOtp(pendingOtp.user.email, otp);
        // await this.smsService.sendOtp(pendingOtp.user.phone, otp);
        console.log(
          `[OTP Cron] Generated OTP ${otp} for user ${pendingOtp.user.email}`,
        );
      } catch (error) {
        console.error(
          `[OTP Cron] Failed to process OTP request ${pendingOtp.id}:`,
          error,
        );
        await this.userOtpRepository.update(pendingOtp.id, {
          status: OtpRequestStatus.FAILED,
        });
      }
    }
  }

  /**
   * Daily cron job to clean up old expired OTPs
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredOtps() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await this.userOtpRepository.delete({
      createdAt: LessThan(thirtyDaysAgo),
    });
  }

  /**
   * User requests a password reset - creates a password reset OTP request
   */
  async requestPasswordReset(
    email: string,
  ): Promise<{ message: string; requestId: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Don't reveal that the user doesn't exist for security
      return {
        message:
          'If your email is registered, you will receive a password reset OTP shortly.',
        requestId: '',
      };
    }

    // Invalidate any existing password reset OTPs for this user
    await this.userOtpRepository.update(
      { userId: user.id, isPasswordReset: true, isUsed: false },
      { isUsed: true, status: OtpRequestStatus.EXPIRED },
    );

    // Create new password reset OTP request
    const userOtp = new UserOtp();
    userOtp.userId = user.id;
    userOtp.isPasswordReset = true;
    userOtp.status = OtpRequestStatus.PENDING;
    userOtp.resetToken = uuidv4(); // Generate unique reset token for additional security

    const savedOtp = await this.userOtpRepository.save(userOtp);
    return {
      message:
        'If your email is registered, you will receive a password reset OTP shortly.',
      requestId: savedOtp.id,
    };
  }

  /**
   * Verify reset OTP and set new password
   */
  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Find a valid password reset OTP
    const userOtp = await this.userOtpRepository.findOne({
      where: {
        userId: user.id,
        otp: otp,
        isUsed: false,
        isPasswordReset: true,
        status: OtpRequestStatus.PROCESSED,
        expiresAt: Not(LessThan(new Date())),
      },
    });

    if (!userOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Mark OTP as used
    userOtp.isUsed = true;
    userOtp.status = OtpRequestStatus.PROCESSED;
    await this.userOtpRepository.save(userOtp);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await this.usersService.updatePassword(user.id, hashedPassword);

    return {
      message:
        'Password has been reset successfully. You can now login with your new password.',
    };
  }

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    await this.usersService.updateLastLogin(user.id);
    return {
      access_token: await this.jwtService.sign(payload),
    };
  }

  async validateUser(userId: string) {
    return this.usersService.findById(userId);
  }

  // Store nonces for wallet authentication (in production, use Redis)
  private walletNonces = new Map<
    string,
    { nonce: string; expiresAt: number; chain: string }
  >();

  async generateNonce(
    walletAddress: string,
    chain: string,
  ): Promise<{ nonce: string; message: string }> {
    // Clean up expired nonces
    const now = Date.now();
    for (const [key, data] of this.walletNonces.entries()) {
      if (data.expiresAt < now) {
        this.walletNonces.delete(key);
      }
    }

    // Create unique key for chain+address
    const uniqueKey = `${chain}:${walletAddress.toLowerCase()}`;

    // Generate new nonce
    const nonce = uuidv4();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    this.walletNonces.set(uniqueKey, { nonce, expiresAt, chain });

    // Create message to sign
    const message = `Sign this message to authenticate with OrionPay. Chain: ${chain}. Nonce: ${nonce}`;
    return { nonce, message };
  }

  async verifyWalletSignature(
    walletAddress: string,
    chain: string,
    signature: string,
    message: string,
    nonce: string,
  ): Promise<{ access_token: string; user: any; isNewUser: boolean }> {
    const uniqueKey = `${chain}:${walletAddress.toLowerCase()}`;

    // Verify nonce exists and is valid
    const storedNonceData = this.walletNonces.get(uniqueKey);
    if (!storedNonceData || storedNonceData.nonce !== nonce) {
      throw new BadRequestException('Invalid or expired nonce');
    }

    if (storedNonceData.expiresAt < Date.now()) {
      this.walletNonces.delete(uniqueKey);
      throw new BadRequestException('Nonce has expired');
    }

    // Verify signature using blockchain service
    let isSignatureValid = false;
    try {
      isSignatureValid = await this.blockchainService.verifySignature(
        chain,
        message,
        signature,
        walletAddress,
      );
    } catch (error) {
      throw new UnauthorizedException('Failed to verify signature');
    }

    if (!isSignatureValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Consume the nonce
    this.walletNonces.delete(uniqueKey);

    // Find or create user
    const userIdentifier = `${chain}:${walletAddress.toLowerCase()}`;
    let user = await this.usersService.findByWalletAddress(userIdentifier);
    let isNewUser = false;

    if (!user) {
      // Create new user with chain-specific wallet address
      const randomPassword = randomBytes(32).toString('hex');
      user = await this.usersService.create({
        email: `${userIdentifier}@wallet.local`,
        password: randomPassword,
        firstName: `${chain.charAt(0).toUpperCase() + chain.slice(1)}`,
        lastName: 'User',
        walletAddress: userIdentifier,
      });
      isNewUser = true;
    }

    // Generate JWT
    const payload = {
      sub: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      chain: chain,
    };
    const access_token = await this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        walletAddress: walletAddress,
        chain: chain,
        email: user.email,
      },
      isNewUser,
    };
  }
}
