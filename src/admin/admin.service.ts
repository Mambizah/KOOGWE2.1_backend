import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, DocumentStatus, DocumentType, Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPendingDrivers() {
    const drivers = await this.prisma.user.findMany({
      where: { role: Role.DRIVER },
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
        pending: driver.documents.filter((doc) => doc.status === DocumentStatus.PENDING).length,
        approved: driver.documents.filter((doc) => doc.status === DocumentStatus.APPROVED).length,
        rejected: driver.documents.filter((doc) => doc.status === DocumentStatus.REJECTED).length,
      },
      canBeApproved: this.hasAllRequiredApprovedDocuments(driver.documents),
    }));
  }

  async getPendingDocuments() {
    return this.prisma.document.findMany({
      where: { status: DocumentStatus.PENDING },
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

  async reviewDocument(params: {
    documentId: string;
    adminId: string;
    status: DocumentStatus;
    rejectionReason?: string;
  }) {
    const { documentId, adminId, status, rejectionReason } = params;

    if (status !== DocumentStatus.APPROVED && status !== DocumentStatus.REJECTED) {
      throw new BadRequestException('Le status doit être APPROVED ou REJECTED');
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { user: true },
    });

    if (!document) throw new NotFoundException('Document introuvable');

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: status === DocumentStatus.REJECTED ? rejectionReason ?? 'Document non conforme' : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (status === DocumentStatus.REJECTED) {
      await this.prisma.user.update({
        where: { id: document.userId },
        data: { accountStatus: AccountStatus.REJECTED },
      });
      await this.prisma.driverProfile
        .update({
          where: { userId: document.userId },
          data: { adminApproved: false },
        })
        .catch(() => undefined);
    } else {
      await this.refreshDriverReviewStatus(document.userId);
    }

    return updated;
  }

  async setDriverApproval(params: {
    driverId: string;
    approved: boolean;
    adminNotes?: string;
  }) {
    const { driverId, approved, adminNotes } = params;

    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true, documents: true },
    });

    if (!driver || driver.role !== Role.DRIVER || !driver.driverProfile) {
      throw new NotFoundException('Chauffeur introuvable');
    }

    if (approved) {
      if (!driver.faceVerified || !driver.driverProfile.documentsUploaded) {
        throw new BadRequestException('Le chauffeur doit finir la vérification faciale et les documents');
      }

      if (!this.hasAllRequiredApprovedDocuments(driver.documents)) {
        throw new BadRequestException('Tous les documents requis doivent être approuvés');
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
          data: { accountStatus: AccountStatus.ACTIVE },
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
        data: { accountStatus: AccountStatus.REJECTED },
      }),
    ]);

    return { success: true, message: 'Chauffeur refusé' };
  }

  private async refreshDriverReviewStatus(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: { userId },
    });

    if (this.hasAllRequiredApprovedDocuments(documents)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus: AccountStatus.ADMIN_REVIEW_PENDING },
      });
    }
  }

  private hasAllRequiredApprovedDocuments(documents: Array<{ type: DocumentType; status: DocumentStatus }>) {
    const requiredTypes: DocumentType[] = [
      DocumentType.ID_CARD_FRONT,
      DocumentType.ID_CARD_BACK,
      DocumentType.SELFIE_WITH_ID,
      DocumentType.DRIVERS_LICENSE,
      DocumentType.VEHICLE_REGISTRATION,
      DocumentType.INSURANCE,
    ];

    return requiredTypes.every((requiredType) =>
      documents.some((doc) => doc.type === requiredType && doc.status === DocumentStatus.APPROVED),
    );
  }
}
