import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { UserOtp } from '../entities/user-otp.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService.signIn', () => {
  let service: AuthService;
  let usersService: Record<string, jest.Mock>;

  const password = 'correct-horse-battery-staple';

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-token') },
        },
        { provide: BlockchainService, useValue: {} },
        { provide: getRepositoryToken(UserOtp), useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  /** Build a user record; `isActive` defaults to active. */
  function user(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'user@example.com',
      password: bcrypt.hashSync(password, 10),
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      ...overrides,
    };
  }

  it('throws for an unknown email', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(service.signIn('nobody@example.com', password)).rejects.toThrow(
      UnauthorizedException,
    );
    // A missing account must not look different from a bad password.
    await expect(service.signIn('nobody@example.com', password)).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('throws for a wrong password', async () => {
    usersService.findByEmail.mockResolvedValue(user());

    await expect(service.signIn('user@example.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a deactivated user even with the correct password', async () => {
    usersService.findByEmail.mockResolvedValue(user({ isActive: false }));

    await expect(service.signIn('user@example.com', password)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('does not issue a token or record a login for a deactivated user', async () => {
    usersService.findByEmail.mockResolvedValue(user({ isActive: false }));

    await expect(service.signIn('user@example.com', password)).rejects.toThrow();
    expect(usersService.updateLastLogin).not.toHaveBeenCalled();
  });

  it('returns a token for an active user', async () => {
    usersService.findByEmail.mockResolvedValue(user());

    const result = await service.signIn('user@example.com', password);

    expect(result).toEqual({ access_token: 'signed-token' });
    expect(usersService.updateLastLogin).toHaveBeenCalledWith('user-1');
  });

  it('uses an identical message for unknown, wrong-password, and deactivated', async () => {
    // Guards the user-enumeration oracle: all three must be indistinguishable.
    const messageFor = async (setup: () => void) => {
      setup();
      try {
        await service.signIn('user@example.com', password);
        return null;
      } catch (error) {
        return (error as UnauthorizedException).message;
      }
    };

    const unknown = await messageFor(() =>
      usersService.findByEmail.mockResolvedValue(null),
    );
    const wrongPassword = await messageFor(async () => {
      usersService.findByEmail.mockResolvedValue(user());
      await expect(service.signIn('user@example.com', 'nope')).rejects.toThrow();
      return undefined;
    });
    const deactivated = await messageFor(() =>
      usersService.findByEmail.mockResolvedValue(user({ isActive: false })),
    );

    expect(deactivated).toBe(unknown);
    expect(deactivated).toBe(wrongPassword);
  });

  it('checks the password before the account status', async () => {
    // A deactivated user with a wrong password must fail on the password path.
    const compareSpy = jest.spyOn(bcrypt, 'compare');
    usersService.findByEmail.mockResolvedValue(user({ isActive: false }));

    await expect(service.signIn('user@example.com', 'wrong-password')).rejects.toThrow(
      'Invalid credentials',
    );
    // bcrypt ran, so the password was verified before any status check.
    expect(compareSpy).toHaveBeenCalled();
  });
});
