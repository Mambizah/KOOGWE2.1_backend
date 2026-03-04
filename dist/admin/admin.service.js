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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma.service");
let AdminService = class AdminService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPendingDrivers() {
        const drivers = await this.prisma.user.findMany({
            where: { role: client_1.Role.DRIVER },
            include: {
                driverProfile: true,
                documents: {
                    orderBy: { uploadedAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return drivers.map((driver) => ({
            id: driver.id,
            name: driver.name,
            email: driver.email,
            phone: driver.phone,
            accountStatus: driver.accountStatus,
            faceVerified: driver.faceVerified,
            driverProfile: driver.driverProfile,
            documents: driver.documents,
            documentsSummary: {
                pending: driver.documents.filter((doc) => doc.status === client_1.DocumentStatus.PENDING).length,
                approved: driver.documents.filter((doc) => doc.status === client_1.DocumentStatus.APPROVED).length,
                rejected: driver.documents.filter((doc) => doc.status === client_1.DocumentStatus.REJECTED).length,
            },
            canBeApproved: this.hasAllRequiredApprovedDocuments(driver.documents),
        }));
    }
    async getPendingDocuments() {
        return this.prisma.document.findMany({
            where: { status: client_1.DocumentStatus.PENDING },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true,
                    },
                },
            },
            orderBy: { uploadedAt: 'asc' },
        });
    }
    async reviewDocument(params) {
        const { documentId, adminId, status, rejectionReason } = params;
        if (status !== client_1.DocumentStatus.APPROVED && status !== client_1.DocumentStatus.REJECTED) {
            throw new common_1.BadRequestException('Le status doit être APPROVED ou REJECTED');
        }
        const document = await this.prisma.document.findUnique({
            where: { id: documentId },
            include: { user: true },
        });
        if (!document)
            throw new common_1.NotFoundException('Document introuvable');
        const updated = await this.prisma.document.update({
            where: { id: documentId },
            data: {
                status,
                reviewedAt: new Date(),
                reviewedBy: adminId,
                rejectionReason: status === client_1.DocumentStatus.REJECTED ? rejectionReason ?? 'Document non conforme' : null,
            },
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
            },
        });
        if (status === client_1.DocumentStatus.REJECTED) {
            await this.prisma.user.update({
                where: { id: document.userId },
                data: { accountStatus: client_1.AccountStatus.REJECTED },
            });
            await this.prisma.driverProfile
                .update({
                where: { userId: document.userId },
                data: { adminApproved: false },
            })
                .catch(() => undefined);
        }
        else {
            await this.refreshDriverReviewStatus(document.userId);
        }
        return updated;
    }
    async setDriverApproval(params) {
        const { driverId, approved, adminNotes } = params;
        const driver = await this.prisma.user.findUnique({
            where: { id: driverId },
            include: { driverProfile: true, documents: true },
        });
        if (!driver || driver.role !== client_1.Role.DRIVER || !driver.driverProfile) {
            throw new common_1.NotFoundException('Chauffeur introuvable');
        }
        if (approved) {
            if (!driver.faceVerified || !driver.driverProfile.documentsUploaded) {
                throw new common_1.BadRequestException('Le chauffeur doit finir la vérification faciale et les documents');
            }
            if (!this.hasAllRequiredApprovedDocuments(driver.documents)) {
                throw new common_1.BadRequestException('Tous les documents requis doivent être approuvés');
            }
            await this.prisma.$transaction([
                this.prisma.driverProfile.update({
                    where: { userId: driverId },
                    data: {
                        adminApproved: true,
                        adminApprovedAt: new Date(),
                        adminNotes: adminNotes ?? null,
                    },
                }),
                this.prisma.user.update({
                    where: { id: driverId },
                    data: { accountStatus: client_1.AccountStatus.ACTIVE },
                }),
            ]);
            return { success: true, message: 'Chauffeur approuvé et activé' };
        }
        await this.prisma.$transaction([
            this.prisma.driverProfile.update({
                where: { userId: driverId },
                data: {
                    adminApproved: false,
                    adminApprovedAt: null,
                    adminNotes: adminNotes ?? 'Refusé par l’administration',
                },
            }),
            this.prisma.user.update({
                where: { id: driverId },
                data: { accountStatus: client_1.AccountStatus.REJECTED },
            }),
        ]);
        return { success: true, message: 'Chauffeur refusé' };
    }
    async refreshDriverReviewStatus(userId) {
        const documents = await this.prisma.document.findMany({
            where: { userId },
        });
        if (this.hasAllRequiredApprovedDocuments(documents)) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { accountStatus: client_1.AccountStatus.ADMIN_REVIEW_PENDING },
            });
        }
    }
    hasAllRequiredApprovedDocuments(documents) {
        const requiredTypes = [
            client_1.DocumentType.ID_CARD_FRONT,
            client_1.DocumentType.ID_CARD_BACK,
            client_1.DocumentType.SELFIE_WITH_ID,
            client_1.DocumentType.DRIVERS_LICENSE,
            client_1.DocumentType.VEHICLE_REGISTRATION,
            client_1.DocumentType.INSURANCE,
        ];
        return requiredTypes.every((requiredType) => documents.some((doc) => doc.type === requiredType && doc.status === client_1.DocumentStatus.APPROVED));
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map