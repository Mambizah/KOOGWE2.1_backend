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
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const prisma_service_1 = require("../prisma.service");
let DocumentsService = class DocumentsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.uploadsRoot = (0, path_1.join)(process.cwd(), 'uploads');
        this.requiredDriverDocs = [
            client_1.DocumentType.ID_CARD_FRONT,
            client_1.DocumentType.ID_CARD_BACK,
            client_1.DocumentType.SELFIE_WITH_ID,
            client_1.DocumentType.DRIVERS_LICENSE,
            client_1.DocumentType.VEHICLE_REGISTRATION,
            client_1.DocumentType.INSURANCE,
        ];
    }
    hasRequiredVehicleInfo(profile) {
        return Boolean(profile.vehicleMake && profile.vehicleModel && profile.licensePlate);
    }
    hasAllRequiredApprovedDocuments(documents) {
        return this.requiredDriverDocs.every((requiredType) => documents.some((doc) => doc.type === requiredType && doc.status === client_1.DocumentStatus.APPROVED));
    }
    parseDocumentType(type) {
        const normalized = (type || '').trim().toUpperCase();
        const value = client_1.DocumentType[normalized];
        if (!value) {
            throw new common_1.BadRequestException('Type de document invalide');
        }
        return value;
    }
    async uploadBase64Document(params) {
        const { userId, type, imageBase64 } = params;
        if (!imageBase64 || imageBase64.length < 100) {
            throw new common_1.BadRequestException('Image invalide');
        }
        const docType = this.parseDocumentType(type);
        const match = imageBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = match?.[1] ?? 'image/jpeg';
        const ext = mimeType.includes('png') ? 'png' : 'jpg';
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        if (buffer.byteLength > 8 * 1024 * 1024) {
            throw new common_1.BadRequestException('Document trop volumineux (max 8MB)');
        }
        const dir = (0, path_1.join)(this.uploadsRoot, 'documents', userId, docType);
        await (0, promises_1.mkdir)(dir, { recursive: true });
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = (0, path_1.join)(dir, fileName);
        await (0, promises_1.writeFile)(filePath, buffer);
        const publicBase = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const fileUrl = `${publicBase}/uploads/documents/${userId}/${docType}/${fileName}`;
        const document = await this.prisma.document.create({
            data: {
                userId,
                type: docType,
                fileUrl,
                status: 'PENDING',
            },
        });
        await this.prisma.driverProfile
            .update({
            where: { userId },
            data: { documentsUploaded: true, documentsUploadedAt: new Date() },
        })
            .catch(() => undefined);
        await this.prisma.user
            .update({
            where: { id: userId },
            data: { accountStatus: client_1.AccountStatus.ADMIN_REVIEW_PENDING },
        })
            .catch(() => undefined);
        return {
            success: true,
            message: 'Document envoyé',
            documentId: document.id,
            fileUrl,
            type: docType,
            status: document.status,
        };
    }
    async listPendingDocuments() {
        return this.prisma.document.findMany({
            where: { status: client_1.DocumentStatus.PENDING },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        accountStatus: true,
                        driverProfile: {
                            select: {
                                faceVerified: true,
                                documentsUploaded: true,
                                adminApproved: true,
                            },
                        },
                    },
                },
            },
            orderBy: { uploadedAt: 'asc' },
        });
    }
    async listPendingDrivers() {
        return this.prisma.user.findMany({
            where: {
                role: 'DRIVER',
                driverProfile: {
                    is: {
                        OR: [
                            { adminApproved: false },
                            { faceVerified: false },
                            { documentsUploaded: false },
                            { vehicleMake: null },
                            { vehicleModel: null },
                            { licensePlate: null },
                        ],
                    },
                },
            },
            select: {
                id: true,
                email: true,
                name: true,
                accountStatus: true,
                driverProfile: {
                    select: {
                        faceVerified: true,
                        documentsUploaded: true,
                        adminApproved: true,
                        adminNotes: true,
                        vehicleMake: true,
                        vehicleModel: true,
                        licensePlate: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async reviewDocument(params) {
        const { documentId, adminId, status, rejectionReason } = params;
        const targetStatus = status === 'APPROVED' ? client_1.DocumentStatus.APPROVED : client_1.DocumentStatus.REJECTED;
        const document = await this.prisma.document.findUnique({ where: { id: documentId } });
        if (!document)
            throw new common_1.NotFoundException('Document introuvable');
        const reviewed = await this.prisma.document.update({
            where: { id: documentId },
            data: {
                status: targetStatus,
                reviewedAt: new Date(),
                reviewedBy: adminId,
                rejectionReason: targetStatus === client_1.DocumentStatus.REJECTED ? rejectionReason ?? 'Document non conforme' : null,
            },
        });
        await this.refreshDriverApprovalState(document.userId);
        return {
            success: true,
            message: targetStatus === client_1.DocumentStatus.APPROVED ? 'Document approuvé' : 'Document rejeté',
            document: reviewed,
        };
    }
    async decideDriverAccount(params) {
        const { driverId, approved, adminNotes } = params;
        const user = await this.prisma.user.findUnique({
            where: { id: driverId },
            include: { driverProfile: true },
        });
        if (!user || user.role !== 'DRIVER' || !user.driverProfile) {
            throw new common_1.NotFoundException('Chauffeur introuvable');
        }
        if (approved) {
            const documents = await this.prisma.document.findMany({
                where: { userId: driverId, type: { in: this.requiredDriverDocs } },
            });
            if (!user.driverProfile.faceVerified || !user.driverProfile.documentsUploaded) {
                throw new common_1.BadRequestException('Le chauffeur doit terminer la vérification faciale et l’envoi des documents');
            }
            if (!this.hasRequiredVehicleInfo(user.driverProfile)) {
                throw new common_1.BadRequestException('Le chauffeur doit renseigner les informations véhicule avant validation');
            }
            if (!this.hasAllRequiredApprovedDocuments(documents)) {
                throw new common_1.BadRequestException('Tous les documents requis doivent être approuvés avant validation');
            }
        }
        await this.prisma.driverProfile.update({
            where: { userId: driverId },
            data: {
                adminApproved: approved,
                adminApprovedAt: approved ? new Date() : null,
                adminNotes: adminNotes ?? null,
            },
        });
        await this.prisma.user.update({
            where: { id: driverId },
            data: {
                accountStatus: approved ? client_1.AccountStatus.ACTIVE : client_1.AccountStatus.REJECTED,
            },
        });
        return {
            success: true,
            message: approved ? 'Compte chauffeur validé' : 'Compte chauffeur rejeté',
        };
    }
    async refreshDriverApprovalState(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { driverProfile: true },
        });
        if (!user || user.role !== 'DRIVER' || !user.driverProfile)
            return;
        const documents = await this.prisma.document.findMany({
            where: { userId, type: { in: this.requiredDriverDocs } },
            orderBy: { uploadedAt: 'desc' },
        });
        const latestByType = new Map();
        for (const doc of documents) {
            if (!latestByType.has(doc.type)) {
                latestByType.set(doc.type, doc.status);
            }
        }
        const statuses = this.requiredDriverDocs.map((type) => latestByType.get(type));
        const hasRejected = statuses.some((status) => status === client_1.DocumentStatus.REJECTED);
        const allApproved = statuses.every((status) => status === client_1.DocumentStatus.APPROVED);
        if (hasRejected) {
            await this.prisma.driverProfile.update({
                where: { userId },
                data: { adminApproved: false, adminApprovedAt: null },
            });
            await this.prisma.user.update({
                where: { id: userId },
                data: { accountStatus: client_1.AccountStatus.REJECTED },
            });
            return;
        }
        const canActivate = allApproved
            && user.driverProfile.faceVerified
            && user.driverProfile.documentsUploaded
            && this.hasRequiredVehicleInfo(user.driverProfile);
        if (canActivate) {
            await this.prisma.driverProfile.update({
                where: { userId },
                data: { adminApproved: true, adminApprovedAt: new Date() },
            });
            await this.prisma.user.update({
                where: { id: userId },
                data: { accountStatus: client_1.AccountStatus.ACTIVE },
            });
            return;
        }
        await this.prisma.driverProfile.update({
            where: { userId },
            data: { adminApproved: false, adminApprovedAt: null },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { accountStatus: client_1.AccountStatus.ADMIN_REVIEW_PENDING },
        });
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map