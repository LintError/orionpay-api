import { JwtStrategy } from '../jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: jest.Mocked<ConfigService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any;

    authService = {
      validateUser: jest.fn(),
    } as any;
  });

  it('should throw when JWT_SECRET is not set', () => {
    configService.get.mockReturnValue(undefined);

    expect(() => {
      new JwtStrategy(configService, authService);
    }).toThrow('JWT_SECRET must be set to a strong, unique value');
  });

  it('should throw when JWT_SECRET is the documented placeholder', () => {
    configService.get.mockReturnValue('change_me_in_production');

    expect(() => {
      new JwtStrategy(configService, authService);
    }).toThrow('JWT_SECRET must be set to a strong, unique value');
  });

  it('should throw when JWT_SECRET is the old hardcoded fallback', () => {
    configService.get.mockReturnValue('default_jwt_secret_key_change_in_production');

    expect(() => {
      new JwtStrategy(configService, authService);
    }).toThrow('JWT_SECRET must be set to a strong, unique value');
  });

  it('should initialize successfully with a valid secret', () => {
    configService.get.mockReturnValue('super-strong-random-secret-key-32-chars-minimum');

    expect(() => {
      strategy = new JwtStrategy(configService, authService);
    }).not.toThrow();

    expect(strategy).toBeDefined();
  });

  it('should throw with empty string secret', () => {
    configService.get.mockReturnValue('');

    expect(() => {
      new JwtStrategy(configService, authService);
    }).toThrow('JWT_SECRET must be set to a strong, unique value');
  });
});

describe('validateJwtSecret helper', () => {
  // Test the validation logic in isolation
  const validateJwtSecret = (secret: string | undefined): string => {
    const FORBIDDEN_SECRETS = new Set([
      'default_jwt_secret_key_change_in_production',
      'change_me_in_production',
    ]);

    if (!secret) {
      throw new Error('JWT_SECRET must be set to a strong, unique value');
    }
    if (FORBIDDEN_SECRETS.has(secret)) {
      throw new Error('JWT_SECRET must be set to a strong, unique value');
    }
    return secret;
  };

  it('should reject undefined', () => {
    expect(() => validateJwtSecret(undefined)).toThrow();
  });

  it('should reject empty string', () => {
    expect(() => validateJwtSecret('')).toThrow();
  });

  it('should reject change_me_in_production', () => {
    expect(() => validateJwtSecret('change_me_in_production')).toThrow();
  });

  it('should reject default_jwt_secret_key_change_in_production', () => {
    expect(() => validateJwtSecret('default_jwt_secret_key_change_in_production')).toThrow();
  });

  it('should accept valid secret', () => {
    const secret = 'valid-strong-secret-key-with-enough-entropy';
    expect(validateJwtSecret(secret)).toBe(secret);
  });
});