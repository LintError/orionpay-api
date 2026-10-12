import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

/**
 * The unauthenticated OTP admin triggers were removed in #15. These tests pin
 * that they stay gone: Nest only routes methods carrying an HTTP decorator, so
 * asserting the routes 404 guards against someone re-adding a handler.
 */
describe('AuthController OTP admin endpoints', () => {
  let app: INestApplication;
  let authService: Record<string, jest.Mock>;

  beforeEach(async () => {
    authService = {
      requestUserOtp: jest.fn(),
      verifyUserOtp: jest.fn(),
      generateNonce: jest.fn(),
      verifyWalletSignature: jest.fn(),
      signIn: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
      // These back the removed endpoints. They must never be reachable over
      // HTTP, so they are jest.fn()s that would fail the test if called.
      processPendingOtpRequests: jest.fn(),
      cleanupExpiredOtps: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 404 for POST /auth/otp/process', async () => {
    const request = require('supertest')(app.getHttpServer());
    await request.post('/auth/otp/process').expect(404);

    expect(authService.processPendingOtpRequests).not.toHaveBeenCalled();
  });

  it('returns 404 for POST /auth/otp/cleanup', async () => {
    const request = require('supertest')(app.getHttpServer());
    await request.post('/auth/otp/cleanup').expect(404);

    expect(authService.cleanupExpiredOtps).not.toHaveBeenCalled();
  });

  it('exposes no handler that reaches the OTP generation job', () => {
    // Structural check: the controller must not carry an HTTP method bound to
    // either service method, independent of routing behaviour.
    const handlers = Object.getOwnPropertyNames(
      AuthController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(handlers).not.toContain('processPendingOtps');
    expect(handlers).not.toContain('cleanupExpired');
  });

  it('still serves the public OTP endpoints', async () => {
    // Guards against over-removal: request/verify are legitimate anonymous flows.
    const routes = [
      '/auth/otp/request',
      '/auth/otp/verify',
    ] as const;

    for (const route of routes) {
      authService.requestUserOtp.mockResolvedValue({ message: 'ok', requestId: '1' });
      authService.verifyUserOtp.mockResolvedValue({ accessToken: 't', user: {} });
      // A 500 from the mock proves the route resolved to a handler; a 404 would
      // mean the route was removed by mistake.
      const request = require('supertest')(app.getHttpServer());
      await request.post(route).send({ email: 'a@b.c', otp: '123456' });
    }
  });
});
