import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Admin } from './entities/admin.entity';
import { AdminOtp } from './entities/admin-otp.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, AdminOtp, User, Transaction]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AdminService, AdminGuard, RolesGuard],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
