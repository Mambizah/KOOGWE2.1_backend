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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async updateVehicle(userId, data) {
        const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Profil chauffeur introuvable');
        return this.prisma.driverProfile.update({
            where: { userId },
            data: {
                vehicleMake: data.vehicleMake,
                vehicleModel: data.vehicleModel,
                vehicleColor: data.vehicleColor,
                licensePlate: data.licensePlate,
            },
        });
    }
    async markFaceVerified(userId) {
        const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Profil chauffeur introuvable');
        return this.prisma.driverProfile.update({
            where: { userId },
            data: { faceVerified: true, faceVerifiedAt: new Date() },
        });
    }
    async markDocumentsUploaded(userId) {
        const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Profil chauffeur introuvable');
        return this.prisma.driverProfile.update({
            where: { userId },
            data: { documentsUploaded: true, documentsUploadedAt: new Date() },
        });
    }
    async getDriverStatus(userId) {
        const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Profil chauffeur introuvable');
        return {
            faceVerified: profile.faceVerified,
            documentsUploaded: profile.documentsUploaded,
            adminApproved: profile.adminApproved,
            currentStep: !profile.faceVerified
                ? 'face_verification'
                : !profile.documentsUploaded
                    ? 'document_upload'
                    : !profile.adminApproved
                        ? 'pending_admin'
                        : 'active',
        };
    }
    async getProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { driverProfile: true },
        });
        if (!user)
            throw new common_1.NotFoundException('Utilisateur introuvable');
        const safeUser = { ...user };
        delete safeUser.password;
        delete safeUser.verificationToken;
        return safeUser;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map