import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const secret = validateJwtSecret(configService.get<string>('JWT_SECRET'));
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    return this.authService.validateUser(payload.sub);
  }
}
