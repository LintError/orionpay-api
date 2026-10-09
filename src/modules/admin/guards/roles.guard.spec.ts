import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AdminRole } from '../entities/admin.entity';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockExecutionContext(options: {
    admin?: { id: string; email: string; role: AdminRole; isAdmin: boolean };
  }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          admin: options.admin,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when no roles metadata is defined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockExecutionContext({});

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should return true when required roles metadata is an empty array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = createMockExecutionContext({});

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when roles are required but request.admin is missing', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.SUPER_ADMIN]);
    const context = createMockExecutionContext({ admin: undefined });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Admin not authenticated');
  });

  it('should return true when admin has a matching required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    const context = createMockExecutionContext({
      admin: {
        id: 'admin-1',
        email: 'admin@orionpay.com',
        role: AdminRole.ADMIN,
        isAdmin: true,
      },
    });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when admin does not have a required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.SUPER_ADMIN]);
    const context = createMockExecutionContext({
      admin: {
        id: 'admin-2',
        email: 'support@orionpay.com',
        role: AdminRole.SUPPORT,
        isAdmin: true,
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Forbidden resource');
  });
});
