import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, DocumentStatus, DocumentType } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DocumentsService {
  private readonly uploadsRoot = join(process.cwd(), 'uploads');
  private readonly requiredDriverDocs: DocumentType[] = [
    DocumentType.ID_CARD_FRONT,
    DocumentType.ID_CARD_BACK,
    DocumentType.SELFIE_WITH_ID,
    DocumentType.DRIVERS_LICENSE,
    DocumentType.VEHICLE_REGISTRATION,
    DocumentType.INSURANCE,
  ];

  constructor(private prisma: PrismaService) {}

  private getPublicBaseUrl() {
    const explicitPublicBase = process.env.PUBLIC_BASE_URL?.trim();
    if (explicitPublicBase) {
      return explicitPublicBase;
    }

    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
    if (railwayDomain) {
      return `https://${railwayDomain}`;
    }

    return `http://localhost:${process.env.PORT || 3000}`;
  }

  private hasRequiredVehicleInfo(profile: {
    vehicleMake: string | null;
    vehicleModel: string | null;
    licensePlate: string | null;
  }) {
    return Boolean(profile.vehicleMake && profile.vehicleModel && profile.licensePlate);
  }

  private hasAllRequiredApprovedDocuments(documents: Array<{ type: DocumentType; status: DocumentStatus }>) {
    return this.requiredDriverDocs.every((requiredType) =>
      documents.some((doc) => doc.type === requiredType && doc.status === DocumentStatus.APPROVED),
    );
  }

  private parseDocumentType(type: string): DocumentType {
    const normalized = (type || '').trim().toUpperCase();
    const value = (DocumentType as Record<string, DocumentType>)[normalized];
    if (!value) {
      throw new BadRequestException('Type de document invalide');
    }
    return value;
  }

  async uploadBase64Document(params: {
    userId: string;
    type: string;
    imageBase64: string;
  }) {
    const { userId, type, imageBase64 } = params;
    if (!imageBase64 || imageBase64.length < 100) {
      throw new BadRequestException('Image invalide');
    }

    const docType = this.parseDocumentType(type);

    const match = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = match?.[1] ?? 'image/jpeg';
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.byteLength > 8 * 1024 * 1024) {
      throw new BadRequestException('Document trop volumineux (max 8MB)');
    }

    const dir = join(this.uploadsRoot, 'documents', userId, docType);
    await mkdir(dir, { recursive: true });

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = join(dir, fileName);
    await writeFile(filePath, buffer);

    const publicBase = this.getPublicBaseUrl();
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
        data: { accountStatus: AccountStatus.ADMIN_REVIEW_PENDING },
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
      where: { status: DocumentStatus.PENDING },
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

  async reviewDocument(params: {
    documentId: string;
    adminId: string;
    status: 'APPROVED' | 'REJECTED';
    rejectionReason?: string;
  }) {
    const { documentId, adminId, status, rejectionReason } = params;
    const targetStatus = status === 'APPROVED' ? DocumentStatus.APPROVED : DocumentStatus.REJECTED;

    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Document introuvable');

    const reviewed = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: targetStatus,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: targetStatus === DocumentStatus.REJECTED ? rejectionReason ?? 'Document non conforme' : null,
      },
    });

    await this.refreshDriverApprovalState(document.userId);

    return {
      success: true,
      message: targetStatus === DocumentStatus.APPROVED ? 'Document approuvé' : 'Document rejeté',
      document: reviewed,
    };
  }

  async decideDriverAccount(params: {
    driverId: string;
    adminId: string;
    approved: boolean;
    adminNotes?: string;
  }) {
    const { driverId, approved, adminNotes } = params;

    const user = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true },
    });
    if (!user || user.role !== 'DRIVER' || !user.driverProfile) {
      throw new NotFoundException('Chauffeur introuvable');
    }

    if (approved) {
      const documents = await this.prisma.document.findMany({
        where: { userId: driverId, type: { in: this.requiredDriverDocs } },
      });

      if (!user.driverProfile.faceVerified || !user.driverProfile.documentsUploaded) {
        throw new BadRequestException('Le chauffeur doit terminer la vérification faciale et l’envoi des documents');
      }

      if (!this.hasRequiredVehicleInfo(user.driverProfile)) {
        throw new BadRequestException('Le chauffeur doit renseigner les informations véhicule avant validation');
      }

      if (!this.hasAllRequiredApprovedDocuments(documents)) {
        throw new BadRequestException('Tous les documents requis doivent être approuvés avant validation');
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
        accountStatus: approved ? AccountStatus.ACTIVE : AccountStatus.REJECTED,
      },
    });

    return {
      success: true,
      message: approved ? 'Compte chauffeur validé' : 'Compte chauffeur rejeté',
    };
  }

  private async refreshDriverApprovalState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!user || user.role !== 'DRIVER' || !user.driverProfile) return;

    const documents = await this.prisma.document.findMany({
      where: { userId, type: { in: this.requiredDriverDocs } },
      orderBy: { uploadedAt: 'desc' },
    });

    const latestByType = new Map<DocumentType, DocumentStatus>();
    for (const doc of documents) {
      if (!latestByType.has(doc.type)) {
        latestByType.set(doc.type, doc.status);
      }
    }

    const statuses = this.requiredDriverDocs.map((type) => latestByType.get(type));
    const hasRejected = statuses.some((status) => status === DocumentStatus.REJECTED);
    const allApproved = statuses.every((status) => status === DocumentStatus.APPROVED);

    if (hasRejected) {
      await this.prisma.driverProfile.update({
        where: { userId },
        data: { adminApproved: false, adminApprovedAt: null },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus: AccountStatus.REJECTED },
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
        data: { accountStatus: AccountStatus.ACTIVE },
      });
      return;
    }

    await this.prisma.driverProfile.update({
      where: { userId },
      data: { adminApproved: false, adminApprovedAt: null },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: AccountStatus.ADMIN_REVIEW_PENDING },
    });
  }
}
