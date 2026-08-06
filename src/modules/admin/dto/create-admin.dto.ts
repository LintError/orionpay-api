import { AdminRole } from '../entities/admin.entity';

export class CreateAdminDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: AdminRole;
}
