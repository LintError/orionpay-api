"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const schedule_1 = require("@nestjs/schedule");
const users_service_1 = require("../users/users.service");
const blockchain_service_1 = require("../blockchain/blockchain.service");
const user_otp_entity_1 = require("./entities/user-otp.entity");
const otp_request_status_enum_1 = require("./enums/otp-request-status.enum");
const bcrypt = __importStar(require("bcrypt"));
const uuid_1 = require("uuid");
const crypto_1 = require("crypto");
let AuthService = class AuthService {
    usersService;
    jwtService;
    blockchainService;
    userOtpRepository;
    constructor(usersService, jwtService, blockchainService, userOtpRepository) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.blockchainService = blockchainService;
        this.userOtpRepository = userOtpRepository;
    }
    async requestUserOtp(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('User account is deactivated');
        }
        const userOtp = this.userOtpRepository.create({
            userId: user.id,
            status: otp_request_status_enum_1.OtpRequestStatus.PENDING,
        });
        await this.userOtpRepository.save(userOtp);
        return {
            message: 'OTP request submitted. You will receive your OTP shortly.',
            requestId: userOtp.id,
        };
    }
    async verifyUserOtp(email, otp) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('User account is deactivated');
        }
        const validOtp = await this.userOtpRepository.findOne({
            where: {
                userId: user.id,
                otp,
                isUsed: false,
                status: otp_request_status_enum_1.OtpRequestStatus.PROCESSED,
            },
        });
        if (!validOtp) {
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        if (new Date() > validOtp.expiresAt) {
            await this.userOtpRepository.update(validOtp.id, {
                isUsed: true,
                status: otp_request_status_enum_1.OtpRequestStatus.EXPIRED,
            });
            throw new common_1.UnauthorizedException('OTP has expired');
        }
        await this.userOtpRepository.update(validOtp.id, { isUsed: true });
        await this.usersService.updateLastLogin(user.id);
        const payload = { sub: user.id, email: user.email };
        const accessToken = this.jwtService.sign(payload);
        const { password, ...result } = user;
        return { accessToken, user: result };
    }
    async processPendingOtpRequests() {
        const pendingOtps = await this.userOtpRepository.find({
            where: { status: otp_request_status_enum_1.OtpRequestStatus.PENDING },
            relations: ['user'],
        });
        if (pendingOtps.length === 0) {
            return;
        }
        console.log(`[OTP Cron] Processing ${pendingOtps.length} pending OTP requests`);
        for (const pendingOtp of pendingOtps) {
            try {
                await this.userOtpRepository.update(pendingOtp.id, {
                    status: otp_request_status_enum_1.OtpRequestStatus.PROCESSING,
                });
                await this.userOtpRepository.update({ userId: pendingOtp.userId, isUsed: false, id: (0, typeorm_2.Not)(pendingOtp.id) }, { isUsed: true, status: otp_request_status_enum_1.OtpRequestStatus.EXPIRED });
                const otp = (0, crypto_1.randomInt)(100000, 999999).toString();
                const expiresAt = new Date();
                expiresAt.setMinutes(expiresAt.getMinutes() + 15);
                await this.userOtpRepository.update(pendingOtp.id, {
                    otp,
                    expiresAt,
                    isUsed: false,
                    status: otp_request_status_enum_1.OtpRequestStatus.PROCESSED,
                    processedAt: new Date(),
                });
                console.log(`[OTP Cron] Generated OTP ${otp} for user ${pendingOtp.user.email}`);
            }
            catch (error) {
                console.error(`[OTP Cron] Failed to process OTP request ${pendingOtp.id}:`, error);
                await this.userOtpRepository.update(pendingOtp.id, {
                    status: otp_request_status_enum_1.OtpRequestStatus.FAILED,
                });
            }
        }
    }
    async cleanupExpiredOtps() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        await this.userOtpRepository.delete({
            createdAt: (0, typeorm_2.LessThan)(thirtyDaysAgo),
        });
    }
    async requestPasswordReset(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return {
                message: 'If your email is registered, you will receive a password reset OTP shortly.',
                requestId: '',
            };
        }
        await this.userOtpRepository.update({ userId: user.id, isPasswordReset: true, isUsed: false }, { isUsed: true, status: otp_request_status_enum_1.OtpRequestStatus.EXPIRED });
        const userOtp = new user_otp_entity_1.UserOtp();
        userOtp.userId = user.id;
        userOtp.isPasswordReset = true;
        userOtp.status = otp_request_status_enum_1.OtpRequestStatus.PENDING;
        userOtp.resetToken = (0, uuid_1.v4)();
        const savedOtp = await this.userOtpRepository.save(userOtp);
        return {
            message: 'If your email is registered, you will receive a password reset OTP shortly.',
            requestId: savedOtp.id,
        };
    }
    async resetPassword(email, otp, newPassword) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        const userOtp = await this.userOtpRepository.findOne({
            where: {
                userId: user.id,
                otp: otp,
                isUsed: false,
                isPasswordReset: true,
                status: otp_request_status_enum_1.OtpRequestStatus.PROCESSED,
                expiresAt: (0, typeorm_2.Not)((0, typeorm_2.LessThan)(new Date())),
            },
        });
        if (!userOtp) {
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        userOtp.isUsed = true;
        userOtp.status = otp_request_status_enum_1.OtpRequestStatus.PROCESSED;
        await this.userOtpRepository.save(userOtp);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.usersService.updatePassword(user.id, hashedPassword);
        return {
            message: 'Password has been reset successfully. You can now login with your new password.',
        };
    }
    async signIn(email, pass) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(pass, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = { sub: user.id, email: user.email };
        await this.usersService.updateLastLogin(user.id);
        return {
            access_token: await this.jwtService.sign(payload),
        };
    }
    async validateUser(userId) {
        return this.usersService.findById(userId);
    }
    walletNonces = new Map();
    async generateNonce(walletAddress, chain) {
        const now = Date.now();
        for (const [key, data] of this.walletNonces.entries()) {
            if (data.expiresAt < now) {
                this.walletNonces.delete(key);
            }
        }
        const uniqueKey = `${chain}:${walletAddress.toLowerCase()}`;
        const nonce = (0, uuid_1.v4)();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        this.walletNonces.set(uniqueKey, { nonce, expiresAt, chain });
        const message = `Sign this message to authenticate with OrionPay. Chain: ${chain}. Nonce: ${nonce}`;
        return { nonce, message };
    }
    async verifyWalletSignature(walletAddress, chain, signature, message, nonce) {
        const uniqueKey = `${chain}:${walletAddress.toLowerCase()}`;
        const storedNonceData = this.walletNonces.get(uniqueKey);
        if (!storedNonceData || storedNonceData.nonce !== nonce) {
            throw new common_1.BadRequestException('Invalid or expired nonce');
        }
        if (storedNonceData.expiresAt < Date.now()) {
            this.walletNonces.delete(uniqueKey);
            throw new common_1.BadRequestException('Nonce has expired');
        }
        let isSignatureValid = false;
        try {
            isSignatureValid = await this.blockchainService.verifySignature(chain, message, signature, walletAddress);
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Failed to verify signature');
        }
        if (!isSignatureValid) {
            throw new common_1.UnauthorizedException('Invalid signature');
        }
        this.walletNonces.delete(uniqueKey);
        const userIdentifier = `${chain}:${walletAddress.toLowerCase()}`;
        let user = await this.usersService.findByWalletAddress(userIdentifier);
        let isNewUser = false;
        if (!user) {
            const randomPassword = (0, crypto_1.randomBytes)(32).toString('hex');
            user = await this.usersService.create({
                email: `${userIdentifier}@wallet.local`,
                password: randomPassword,
                firstName: `${chain.charAt(0).toUpperCase() + chain.slice(1)}`,
                lastName: 'User',
                walletAddress: userIdentifier,
            });
            isNewUser = true;
        }
        const payload = {
            sub: user.id,
            email: user.email,
            walletAddress: user.walletAddress,
            chain: chain,
        };
        const access_token = await this.jwtService.sign(payload);
        return {
            access_token,
            user: {
                id: user.id,
                walletAddress: walletAddress,
                chain: chain,
                email: user.email,
            },
            isNewUser,
        };
    }
};
exports.AuthService = AuthService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_30_SECONDS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthService.prototype, "processPendingOtpRequests", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthService.prototype, "cleanupExpiredOtps", null);
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(user_otp_entity_1.UserOtp)),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        blockchain_service_1.BlockchainService,
        typeorm_2.Repository])
], AuthService);
//# sourceMappingURL=auth.service.js.map