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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const admin_entity_1 = require("./entities/admin.entity");
const admin_otp_entity_1 = require("./entities/admin-otp.entity");
let AdminService = class AdminService {
    adminRepository;
    adminOtpRepository;
    jwtService;
    constructor(adminRepository, adminOtpRepository, jwtService) {
        this.adminRepository = adminRepository;
        this.adminOtpRepository = adminOtpRepository;
        this.jwtService = jwtService;
    }
    async generateOtp(email) {
        const admin = await this.adminRepository.findOne({ where: { email } });
        if (!admin) {
            throw new common_1.NotFoundException('Admin not found');
        }
        if (!admin.isActive) {
            throw new common_1.UnauthorizedException('Admin account is deactivated');
        }
        await this.adminOtpRepository.update({ adminId: admin.id, isUsed: false }, { isUsed: true });
        const otp = (0, crypto_1.randomInt)(100000, 999999).toString();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);
        const adminOtp = this.adminOtpRepository.create({
            otp,
            adminId: admin.id,
            expiresAt,
            isUsed: false,
        });
        await this.adminOtpRepository.save(adminOtp);
        if (process.env.NODE_ENV === 'development') {
            return { message: 'OTP generated successfully', otp };
        }
        return { message: 'OTP sent to your registered email' };
    }
    async verifyOtp(email, otp) {
        const admin = await this.adminRepository.findOne({ where: { email } });
        if (!admin) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!admin.isActive) {
            throw new common_1.UnauthorizedException('Admin account is deactivated');
        }
        const validOtp = await this.adminOtpRepository.findOne({
            where: {
                adminId: admin.id,
                otp,
                isUsed: false,
            },
        });
        if (!validOtp) {
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        if (new Date() > validOtp.expiresAt) {
            await this.adminOtpRepository.update(validOtp.id, { isUsed: true });
            throw new common_1.UnauthorizedException('OTP has expired');
        }
        await this.adminOtpRepository.update(validOtp.id, { isUsed: true });
        await this.adminRepository.update(admin.id, { lastLoginAt: new Date() });
        const payload = {
            sub: admin.id,
            email: admin.email,
            role: admin.role,
            isAdmin: true,
        };
        const accessToken = this.jwtService.sign(payload);
        const { password, ...result } = admin;
        return { accessToken, admin: result };
    }
    async create(createAdminDto) {
        const existingAdmin = await this.adminRepository.findOne({
            where: { email: createAdminDto.email },
        });
        if (existingAdmin) {
            throw new common_1.ConflictException('Admin with this email already exists');
        }
        const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);
        const admin = this.adminRepository.create({
            ...createAdminDto,
            password: hashedPassword,
        });
        const savedAdmin = await this.adminRepository.save(admin);
        const { password, ...result } = savedAdmin;
        return result;
    }
    async login(adminLoginDto) {
        const admin = await this.adminRepository.findOne({
            where: { email: adminLoginDto.email },
        });
        if (!admin) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!admin.isActive) {
            throw new common_1.UnauthorizedException('Admin account is deactivated');
        }
        const isPasswordValid = await bcrypt.compare(adminLoginDto.password, admin.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        await this.adminRepository.update(admin.id, { lastLoginAt: new Date() });
        const payload = {
            sub: admin.id,
            email: admin.email,
            role: admin.role,
            isAdmin: true,
        };
        const accessToken = this.jwtService.sign(payload);
        const { password, ...result } = admin;
        return { accessToken, admin: result };
    }
    async findAll() {
        const admins = await this.adminRepository.find();
        return admins.map(({ password, ...rest }) => rest);
    }
    async findOne(id) {
        const admin = await this.adminRepository.findOne({ where: { id } });
        if (!admin) {
            throw new common_1.NotFoundException('Admin not found');
        }
        const { password, ...result } = admin;
        return result;
    }
    async update(id, updateAdminDto) {
        const admin = await this.adminRepository.findOne({ where: { id } });
        if (!admin) {
            throw new common_1.NotFoundException('Admin not found');
        }
        if (updateAdminDto.password) {
            updateAdminDto.password = await bcrypt.hash(updateAdminDto.password, 10);
        }
        Object.assign(admin, updateAdminDto);
        const updatedAdmin = await this.adminRepository.save(admin);
        const { password, ...result } = updatedAdmin;
        return result;
    }
    async remove(id) {
        const result = await this.adminRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException('Admin not found');
        }
    }
    async getAllUsers(userRepository) {
        return userRepository.find({
            select: [
                'id',
                'email',
                'firstName',
                'lastName',
                'isActive',
                'createdAt',
                'walletAddress',
            ],
        });
    }
    async toggleUserStatus(userRepository, userId) {
        const user = await userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        user.isActive = !user.isActive;
        return userRepository.save(user);
    }
    async getAllTransactions(transactionRepository) {
        return transactionRepository.find({ relations: ['user', 'wallet'] });
    }
    async getTransactionStats(transactionRepository) {
        const totalTransactions = await transactionRepository.count();
        const totalVolume = await transactionRepository
            .createQueryBuilder('transaction')
            .select('SUM(transaction.amount)', 'total')
            .getRawOne();
        const recentTransactions = await transactionRepository.find({
            order: { createdAt: 'DESC' },
            take: 10,
        });
        return {
            totalTransactions,
            totalVolume: totalVolume.total || 0,
            recentTransactions,
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(admin_entity_1.Admin)),
    __param(1, (0, typeorm_1.InjectRepository)(admin_otp_entity_1.AdminOtp)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService])
], AdminService);
//# sourceMappingURL=admin.service.js.map