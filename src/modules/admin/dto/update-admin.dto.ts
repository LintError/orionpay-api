import { AdminRole } from '../entities/admin.entity';

export class UpdateAdminDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: AdminRole;
  isActive?: boolean;
}
