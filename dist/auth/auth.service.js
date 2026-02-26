"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const prisma_service_1 = require("../prisma.service");
const mail_service_1 = require("../mail.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, mailService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.mailService = mailService;
    }
    async create(createAuthDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: createAuthDto.email },
        });
        if (existing)
            throw new common_1.ConflictException('Cet email est déjà utilisé');
        const hashedPassword = await bcrypt.hash(createAuthDto.password, 12);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const isDriver = createAuthDto.role === 'DRIVER';
        const newUser = await this.prisma.user.create({
            data: {
                email: createAuthDto.email,
                name: createAuthDto.name,
                password: hashedPassword,
                phone: createAuthDto.phone,
                role: createAuthDto.role ?? 'PASSENGER',
                isVerified: true,
                accountStatus: 'EMAIL_VERIFIED',
                verificationToken: verificationCode,
                wallet: { create: {} },
                driverProfile: isDriver ? { create: {} } : undefined,
            },
        });
        return { message: 'Compte créé avec succès', email: newUser.email };
    }
    async verifyEmail(email, code) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user)
            throw new common_1.BadRequestException('Email introuvable');
        if (user.isVerified)
            return { message: 'Compte déjà vérifié' };
        if (user.verificationToken !== code)
            throw new common_1.BadRequestException('Code invalide');
        await this.prisma.user.update({
            where: { email },
            data: {
                isVerified: true,
                accountStatus: 'EMAIL_VERIFIED',
                verificationToken: null,
            },
        });
        return { message: 'Compte vérifié avec succès !' };
    }
    async login(email, password) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user)
            throw new common_1.UnauthorizedException('Email incorrect');
        if (!user.isVerified)
            throw new common_1.UnauthorizedException('Veuillez vérifier votre email avant de vous connecter.');
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            throw new common_1.UnauthorizedException('Mot de passe incorrect');
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const payload = { sub: user.id, email: user.email, role: user.role };
        return {
            access_token: await this.jwtService.signAsync(payload),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                accountStatus: user.accountStatus,
            },
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, typeof (_a = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _a : Object, mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map