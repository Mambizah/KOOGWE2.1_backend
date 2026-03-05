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

  private getPublicBaseUrl() {
    const explicitPublicBase = process.env.PUBLIC_BASE_URL?.trim();
    if (explicitPublicBase) return explicitPublicBase;

    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
    if (railwayDomain) return `https://${railwayDomain}`;

    return `http://localhost:${process.env.PORT || 3000}`;
  }

  private resolveFileUrl(fileUrl: string) {
    if (!fileUrl) return fileUrl;

    if (fileUrl.startsWith('http://localhost') || fileUrl.startsWith('https://localhost')) {
      const uploadsIndex = fileUrl.indexOf('/uploads/');
      if (uploadsIndex >= 0) {
        return `${this.getPublicBaseUrl()}${fileUrl.slice(uploadsIndex)}`;
      }
    }

    return fileUrl;
  }

  private mapDocumentWithResolvedUrl<T extends { fileUrl: string }>(document: T) {
    return {
      ...document,
      fileUrl: this.resolveFileUrl(document.fileUrl),
    };
  }

  async getDashboardSummary() {
    const [
      pendingDocuments,
      approvedDocuments,
      rejectedDocuments,
      pendingDrivers,
      activeDrivers,
      totalDrivers,
      totalPassengers,
      totalRides,
      ridesRequested,
      ridesInProgress,
      ridesCompleted,
      ridesCancelled,
    ] = await Promise.all([
      this.prisma.document.count({ where: { status: DocumentStatus.PENDING } }),
      this.prisma.document.count({ where: { status: DocumentStatus.APPROVED } }),
      this.prisma.document.count({ where: { status: DocumentStatus.REJECTED } }),
      this.prisma.user.count({
        where: {
          role: Role.DRIVER,
          accountStatus: {
            in: [
              AccountStatus.FACE_VERIFICATION_PENDING,
              AccountStatus.DOCUMENTS_PENDING,
              AccountStatus.ADMIN_REVIEW_PENDING,
            ],
          },
        },
      }),
      this.prisma.user.count({
        where: { role: Role.DRIVER, accountStatus: AccountStatus.ACTIVE },
      }),
      this.prisma.user.count({ where: { role: Role.DRIVER } }),
      this.prisma.user.count({ where: { role: Role.PASSENGER } }),
      this.prisma.ride.count(),
      this.prisma.ride.count({ where: { status: 'REQUESTED' } }),
      this.prisma.ride.count({ where: { status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } } }),
      this.prisma.ride.count({ where: { status: 'COMPLETED' } }),
      this.prisma.ride.count({ where: { status: 'CANCELLED' } }),
    ]);

    return {
      pendingDocuments,
      approvedDocuments,
      rejectedDocuments,
      pendingDrivers,
      activeDrivers,
      totalDrivers,
      totalPassengers,
      totalRides,
      ridesRequested,
      ridesInProgress,
      ridesCompleted,
      ridesCancelled,
      users: {
        drivers: totalDrivers,
        passengers: totalPassengers,
      },
      documents: {
        pending: pendingDocuments,
        approved: approvedDocuments,
        rejected: rejectedDocuments,
      },
      rides: {
        total: totalRides,
        requested: ridesRequested,
        inProgress: ridesInProgress,
        completed: ridesCompleted,
        cancelled: ridesCancelled,
      },
    };
  }

  async getLoginActivity() {
    const users = await this.prisma.user.findMany({
      where: { lastLoginAt: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { lastLoginAt: 'desc' },
      take: 100,
    });

    return users.map((user) => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    }));
  }

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
      documentsResolved: driver.documents.map((doc) => this.mapDocumentWithResolvedUrl(doc)),
      documentsSummary: {
        pending: driver.documents.filter((doc) => doc.status === DocumentStatus.PENDING).length,
        approved: driver.documents.filter((doc) => doc.status === DocumentStatus.APPROVED).length,
        rejected: driver.documents.filter((doc) => doc.status === DocumentStatus.REJECTED).length,
      },
      canBeApproved: this.hasAllRequiredApprovedDocuments(driver.documents),
    }));
  }

  async getPendingDocuments() {
    const documents = await this.prisma.document.findMany({
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

    return documents.map((doc) => this.mapDocumentWithResolvedUrl(doc));
  }

  async getApprovedDocuments() {
    const documents = await this.prisma.document.findMany({
      where: { status: DocumentStatus.APPROVED },
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
      orderBy: { reviewedAt: 'desc' },
      take: 300,
    });

    return documents.map((doc) => this.mapDocumentWithResolvedUrl(doc));
  }

  async getDocumentDetails(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            accountStatus: true,
            driverProfile: true,
          },
        },
      },
    });

    if (!document) throw new NotFoundException('Document introuvable');

    return this.mapDocumentWithResolvedUrl(document);
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

    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      this.prisma.document.count({ where: { status: DocumentStatus.PENDING } }),
      this.prisma.document.count({ where: { status: DocumentStatus.APPROVED } }),
      this.prisma.document.count({ where: { status: DocumentStatus.REJECTED } }),
    ]);

    return {
      ...this.mapDocumentWithResolvedUrl(updated),
      message: status === DocumentStatus.APPROVED ? 'Document approuvé' : 'Document rejeté',
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    };
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
