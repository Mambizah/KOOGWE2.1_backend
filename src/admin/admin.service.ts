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

  private toDocumentStatus(inputStatus?: string, approved?: boolean): DocumentStatus {
    if (typeof approved === 'boolean') {
      return approved ? DocumentStatus.APPROVED : DocumentStatus.REJECTED;
    }

    const normalized = (inputStatus || '').trim().toUpperCase();
    if (normalized === 'APPROVED' || normalized === 'APPROVE' || normalized === 'VALIDATED') {
      return DocumentStatus.APPROVED;
    }
    if (normalized === 'REJECTED' || normalized === 'REJECT' || normalized === 'REFUSED') {
      return DocumentStatus.REJECTED;
    }

    throw new BadRequestException('Le status doit être APPROVED ou REJECTED');
  }

  private mapDocumentForAdmin<T extends { fileUrl: string; user?: any }>(document: T) {
    const resolved = this.mapDocumentWithResolvedUrl(document);
    const uploaderName = resolved.user?.name || resolved.user?.email || resolved.user?.phone || resolved.user?.id;

    return {
      ...resolved,
      uploaderId: resolved.user?.id ?? null,
      uploaderName,
      uploaderEmail: resolved.user?.email ?? null,
      uploaderPhone: resolved.user?.phone ?? null,
    };
  }

  private toDocumentFilterStatus(status?: string): DocumentStatus | undefined {
    const normalized = (status || '').trim().toUpperCase();
    if (!normalized) return undefined;
    if (normalized === 'PENDING') return DocumentStatus.PENDING;
    if (normalized === 'APPROVED') return DocumentStatus.APPROVED;
    if (normalized === 'REJECTED') return DocumentStatus.REJECTED;
    return undefined;
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

    return documents.map((doc) => this.mapDocumentForAdmin(doc));
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

    return documents.map((doc) => this.mapDocumentForAdmin(doc));
  }

  async getDocumentsByStatus(status?: string) {
    const filterStatus = this.toDocumentFilterStatus(status);

    if (filterStatus === DocumentStatus.APPROVED) {
      return this.getApprovedDocuments();
    }

    if (filterStatus === DocumentStatus.REJECTED) {
      const documents = await this.prisma.document.findMany({
        where: { status: DocumentStatus.REJECTED },
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

      return documents.map((doc) => this.mapDocumentForAdmin(doc));
    }

    return this.getPendingDocuments();
  }

  async getActivePanics() {
    const panics = await this.prisma.notification.findMany({
      where: { type: 'PANIC' },
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
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return panics.map((panic) => ({
      id: panic.id,
      title: panic.title,
      body: panic.body,
      isRead: panic.isRead,
      createdAt: panic.createdAt,
      user: panic.user,
    }));
  }

  async getDrivers(page = 1, limit = 50) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.floor(limit)) : 50;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.DRIVER },
        include: {
          driverProfile: true,
          documents: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.user.count({ where: { role: Role.DRIVER } }),
    ]);

    return {
      page: safePage,
      limit: safeLimit,
      total,
      items: items.map((driver) => ({
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        role: driver.role,
        accountStatus: driver.accountStatus,
        createdAt: driver.createdAt,
        lastLoginAt: driver.lastLoginAt,
        driverProfile: driver.driverProfile,
        documentsSummary: {
          total: driver.documents.length,
          pending: driver.documents.filter((doc) => doc.status === DocumentStatus.PENDING).length,
          approved: driver.documents.filter((doc) => doc.status === DocumentStatus.APPROVED).length,
          rejected: driver.documents.filter((doc) => doc.status === DocumentStatus.REJECTED).length,
        },
      })),
    };
  }

  async getPassengers(page = 1, limit = 50) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.floor(limit)) : 50;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.PASSENGER },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          accountStatus: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.user.count({ where: { role: Role.PASSENGER } }),
    ]);

    return {
      page: safePage,
      limit: safeLimit,
      total,
      items,
    };
  }

  async getFinanceTransactions(page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.floor(limit)) : 20;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.transaction.count(),
    ]);

    return {
      page: safePage,
      limit: safeLimit,
      total,
      items,
    };
  }

  async getFinanceStats() {
    const [
      transactionsTotal,
      recharges,
      payments,
      withdrawals,
      pendingWithdrawals,
    ] = await Promise.all([
      this.prisma.transaction.count(),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'RECHARGE', status: 'COMPLETED' },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'PAYMENT', status: 'COMPLETED' },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'WITHDRAWAL' },
      }),
      this.prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
    ]);

    return {
      transactionsTotal,
      rechargeAmount: recharges._sum.amount ?? 0,
      paymentAmount: Math.abs(payments._sum.amount ?? 0),
      withdrawalAmount: Math.abs(withdrawals._sum.amount ?? 0),
      pendingWithdrawals,
    };
  }

  async getFinanceChart(period = 'weekly') {
    const now = new Date();
    const days = period === 'monthly' ? 30 : period === 'daily' ? 1 : 7;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const transactions = await this.prisma.transaction.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, amount: true, type: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      period,
      since,
      points: transactions.map((tx) => ({
        at: tx.createdAt,
        amount: tx.amount,
        type: tx.type,
      })),
    };
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

    return this.mapDocumentForAdmin(document);
  }

  async reviewDocument(params: {
    documentId: string;
    adminId: string;
    status?: string;
    approved?: boolean;
    rejectionReason?: string;
  }) {
    const { documentId, adminId, status, approved, rejectionReason } = params;
    const targetStatus = this.toDocumentStatus(status, approved);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { user: true },
    });

    if (!document) throw new NotFoundException('Document introuvable');

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: targetStatus,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: targetStatus === DocumentStatus.REJECTED ? rejectionReason ?? 'Document non conforme' : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (targetStatus === DocumentStatus.REJECTED) {
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
      message: targetStatus === DocumentStatus.APPROVED ? 'Document approuvé' : 'Document rejeté',
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
