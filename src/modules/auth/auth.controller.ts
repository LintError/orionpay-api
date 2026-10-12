import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WalletConnectDto, GenerateNonceDto } from './dto/wallet-connect.dto';
import { UserGenerateOtpDto } from './dto/user-generate-otp.dto';
import { UserVerifyOtpDto } from './dto/user-verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: { email: string; password: string }) {
    return this.authService.signIn(loginDto.email, loginDto.password);
  }

  @Post('wallet/nonce')
  @HttpCode(HttpStatus.OK)
  async generateWalletNonce(@Body() generateNonceDto: GenerateNonceDto) {
    return this.authService.generateNonce(
      generateNonceDto.walletAddress,
      generateNonceDto.chain,
    );
  }

  @Post('wallet/connect')
  @HttpCode(HttpStatus.OK)
  async connectWallet(@Body() walletConnectDto: WalletConnectDto) {
    return this.authService.verifyWalletSignature(
      walletConnectDto.walletAddress,
      walletConnectDto.chain,
      walletConnectDto.signature,
      walletConnectDto.message,
      walletConnectDto.nonce,
    );
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() userGenerateOtpDto: UserGenerateOtpDto) {
    return this.authService.requestUserOtp(userGenerateOtpDto.email);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() userVerifyOtpDto: UserVerifyOtpDto) {
    return this.authService.verifyUserOtp(
      userVerifyOtpDto.email,
      userVerifyOtpDto.otp,
    );
  }

  // NOTE: `POST /auth/otp/process` and `POST /auth/otp/cleanup` were removed.
  // Both were unauthenticated, unguarded "admin" triggers: /otp/process forced
  // OTP generation for every pending request (and logged the codes to stdout),
  // and /otp/cleanup deleted OTP rows. Both operations already run on cron -
  // processPendingOtpRequests every 30s and cleanupExpiredOtps daily - so the
  // HTTP triggers added no capability while exposing an OTP-disclosure
  // primitive and a data-deletion endpoint to anonymous callers. See #15.

  // Forgot password / password reset endpoints
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.otp,
      resetPasswordDto.newPassword,
    );
  }
}
