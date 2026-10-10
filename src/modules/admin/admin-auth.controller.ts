import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  login(@Body() adminLoginDto: AdminLoginDto) {
    return this.adminService.login(adminLoginDto);
  }

  @Post('otp/generate')
  generateOtp(@Body() generateOtpDto: GenerateOtpDto) {
    return this.adminService.generateOtp(generateOtpDto.email);
  }

  @Post('otp/verify')
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.adminService.verifyOtp(verifyOtpDto.email, verifyOtpDto.otp);
  }
}