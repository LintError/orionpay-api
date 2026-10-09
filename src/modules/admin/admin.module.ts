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

const FORBIDDEN_SECRETS = new Set([
  'default_jwt_secret_key_change_in_production',
  'change_me_in_production',
]);

function validateJwtSecret(secret: string | undefined): string {
  if (!secret) {
    throw new Error('JWT_SECRET must be set to a strong, unique value');
  }
  if (FORBIDDEN_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET must be set to a strong, unique value');
  }
  return secret;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, AdminOtp, User, Transaction]),
    JwtModule.register({
      secret: validateJwtSecret(process.env.JWT_SECRET),
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AdminService, AdminGuard, RolesGuard],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
