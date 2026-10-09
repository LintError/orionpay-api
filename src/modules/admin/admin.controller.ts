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
import { AdminRole } from './entities/admin.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../payments/entities/transaction.entity';

@Controller('admin')
@UseGuards(AdminGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  @Post('admins')
  @Roles(AdminRole.SUPER_ADMIN)
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(createAdminDto);
  }

  @Get('admins')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  findAll() {
    return this.adminService.findAll();
  }

  @Get('admins/:id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  @Patch('admins/:id')
  @Roles(AdminRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.adminService.update(id, updateAdminDto);
  }

  @Delete('admins/:id')
  @Roles(AdminRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.adminService.remove(id);
  }

  // User management endpoints
  @Get('users')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  getAllUsers() {
    return this.adminService.getAllUsers(this.userRepository);
  }

  @Patch('users/:id/toggle-status')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  toggleUserStatus(@Param('id') id: string) {
    return this.adminService.toggleUserStatus(this.userRepository, id);
  }

  // Transaction management endpoints
  @Get('transactions')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  getAllTransactions() {
    return this.adminService.getAllTransactions(this.transactionRepository);
  }

  @Get('dashboard/stats')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  getDashboardStats() {
    return this.adminService.getTransactionStats(this.transactionRepository);
  }
}