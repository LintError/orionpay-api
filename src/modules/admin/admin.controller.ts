import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AdminRole } from './entities/admin.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../payments/entities/transaction.entity';

@Controller('admin')
@UseGuards(AdminGuard, RolesGuard) // Apply guards globally to all admin routes
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  @Post('login')
  @Roles() // No auth required for login
  login(@Body() adminLoginDto: AdminLoginDto) {
    return this.adminService.login(adminLoginDto);
  }

  @Post('otp/generate')
  @Roles() // No auth required to request OTP
  generateOtp(@Body() generateOtpDto: GenerateOtpDto) {
    return this.adminService.generateOtp(generateOtpDto.email);
  }

  @Post('otp/verify')
  @Roles() // No auth required to verify OTP
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.adminService.verifyOtp(verifyOtpDto.email, verifyOtpDto.otp);
  }

  @Post('admins')
  @Roles(AdminRole.SUPER_ADMIN) // Only Super Admins can create other admins
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(createAdminDto);
  }

  @Get('admins')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) // Super Admins and Admins can view admin list
  findAll() {
    return this.adminService.findAll();
  }

  @Get('admins/:id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) // Super Admins and Admins can view admin details
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  @Patch('admins/:id')
  @Roles(AdminRole.SUPER_ADMIN) // Only Super Admins can update other admins
  update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.adminService.update(id, updateAdminDto);
  }

  @Delete('admins/:id')
  @Roles(AdminRole.SUPER_ADMIN) // Only Super Admins can delete admins
  remove(@Param('id') id: string) {
    return this.adminService.remove(id);
  }

  // User management endpoints
  @Get('users')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR) // All admin roles can view users
  getAllUsers() {
    return this.adminService.getAllUsers(this.userRepository);
  }

  @Patch('users/:id/toggle-status')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) // Only Super Admins and Admins can manage user status
  toggleUserStatus(@Param('id') id: string) {
    return this.adminService.toggleUserStatus(this.userRepository, id);
  }

  // Transaction management endpoints
  @Get('transactions')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR) // All admin roles can view transactions
  getAllTransactions() {
    return this.adminService.getAllTransactions(this.transactionRepository);
  }

  @Get('dashboard/stats')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR) // All admin roles can view dashboard
  getDashboardStats() {
    return this.adminService.getTransactionStats(this.transactionRepository);
  }
}
