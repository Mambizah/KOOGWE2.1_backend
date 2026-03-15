import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RidesGateway } from '../rides/rides.gateway';
import { AccountStatus, DocumentStatus, DocumentType, Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';

// BUG FIX: liste unifiée des documents obligatoires (était 3 ici, 6 dans documents.service)
// Doit être IDENTIQUE à celle de documents.service.ts
const REQUIRED_DRIVER_DOCS: DocumentType[] = [
  DocumentType.ID_CARD_FRONT,
  DocumentType.ID_CARD_BACK,
  DocumentType.SELFIE_WITH_ID,
  DocumentType.DRIVERS_LICENSE,
  DocumentType.VEHICLE_REGISTRATION,
  DocumentType.INSURANCE,
];

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private ridesGateway: RidesGateway,
  ) {}

  private resolveFileUrl(fileUrl: string) {
    if (!fileUrl) return fileUrl;
    if (fileUrl.startsWith('http://localhost')) {
      const idx = fileUrl.indexOf('/uploads/');
      if (idx >= 0) {
        const base = process.env.PUBLIC_BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');
        return `${base}${fileUrl.slice(idx)}`;
      }
    }
    return fileUrl;
  }

  private mapDocumentForAdmin<T extends { fileUrl: string; user?: any }>(doc: T) {
    const resolved = { ...doc, fileUrl: this.resolveFileUrl(doc.fileUrl) };
    const name = resolved.user?.name || resolved.user?.email || 'Inconnu';
    return {
      ...resolved,
      url:           resolved.fileUrl,
      driverName:    name,
      uploaderName:  name,
      uploaderId:    resolved.user?.id    ?? null,
      uploaderEmail: resolved.user?.email ?? null,
      uploaderPhone: resolved.user?.phone ?? null,
    };
  }

  private toDocumentStatus(inputStatus?: string, approved?: boolean): DocumentStatus {
    if (typeof approved === 'boolean') return approved ? DocumentStatus.APPROVED : DocumentStatus.REJECTED;
    const n = (inputStatus || '').trim().toUpperCase();
    if (['APPROVED','APPROVE','VALIDATED'].includes(n)) return DocumentStatus.APPROVED;
    if (['REJECTED','REJECT','REFUSED'].includes(n))    return DocumentStatus.REJECTED;
    throw new BadRequestException('Le status doit être APPROVED ou REJECTED');
  }

  // BUG FIX: utilise la liste complète à 6 documents
  private hasAllRequiredApprovedDocuments(documents: Array<{ type: DocumentType; status: DocumentStatus }>) {
    return REQUIRED_DRIVER_DOCS.every(r =>
      documents.some(d => d.type === r && d.status === DocumentStatus.APPROVED)
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  async getDashboardStats() {
    const [
      totalDrivers, activeDrivers, pendingDrivers,
      totalPassengers, totalRides, activeRides,
      pendingDocs, revenue,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.DRIVER } }),
      this.prisma.user.count({ where: { role: Role.DRIVER, accountStatus: AccountStatus.ACTIVE } }),
      this.prisma.user.count({ where: { role: Role.DRIVER, accountStatus: 'ADMIN_REVIEW_PENDING' as any } }),
      this.prisma.user.count({ where: { role: Role.PASSENGER } }),
      this.prisma.ride.count(),
      this.prisma.ride.count({ where: { status: { in: ['ACCEPTED','ARRIVED','IN_PROGRESS'] } } }),
      this.prisma.document.count({ where: { status: DocumentStatus.PENDING } }),
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT', status: 'COMPLETED' } }),
    ]);

    return {
      totalDrivers, activeDrivers, pendingDrivers,
      totalPassengers, totalRides, activeRides,
      pendingDocs, panicAlerts: 0,
      revenue: revenue._sum.amount ?? 0,
    };
  }

  async getDashboardSummary() {
    return this.getDashboardStats();
  }

  // ─── Courses ─────────────────────────────────────────────────────────────────
  async getRecentRides() {
    return this.prisma.ride.findMany({
      include: {
        passenger: { select: { id: true, name: true, email: true } },
        driver:    { select: { id: true, name: true, email: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 20,
    });
  }

  async getActiveRides() {
    return this.prisma.ride.findMany({
      where: { status: { in: ['REQUESTED','ACCEPTED','ARRIVED','IN_PROGRESS'] } },
      include: {
        passenger: { select: { id: true, name: true, email: true, phone: true } },
        driver:    { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async getRides(limit = 50) {
    return this.prisma.ride.findMany({
      include: {
        passenger: { select: { id: true, name: true, email: true } },
        driver:    { select: { id: true, name: true, email: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });
  }

  // ─── Utilisateurs ────────────────────────────────────────────────────────────
  async getDrivers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.DRIVER },
        include: { driverProfile: true, documents: true },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      this.prisma.user.count({ where: { role: Role.DRIVER } }),
    ]);

    return {
      page, limit, total,
      items: items.map(d => ({
        id: d.id, name: d.name, email: d.email, phone: d.phone,
        role: d.role, accountStatus: d.accountStatus,
        createdAt: d.createdAt, lastLoginAt: d.lastLoginAt,
        faceVerified: d.faceVerified,
        vehicleMake:  d.driverProfile?.vehicleMake,
        vehicleModel: d.driverProfile?.vehicleModel,
        vehicleColor: d.driverProfile?.vehicleColor,
        vehicleYear:  d.driverProfile?.vehicleYear,
        licensePlate: d.driverProfile?.licensePlate,
        rating:       d.driverProfile?.rating ?? 0,
        totalRides:   d.driverProfile?.totalRides ?? 0,
        adminApproved: d.driverProfile?.adminApproved ?? false,
        documentsSummary: {
          total:    d.documents.length,
          pending:  d.documents.filter(doc => doc.status === DocumentStatus.PENDING).length,
          approved: d.documents.filter(doc => doc.status === DocumentStatus.APPROVED).length,
          rejected: d.documents.filter(doc => doc.status === DocumentStatus.REJECTED).length,
        },
      })),
    };
  }

  async getPendingDrivers() {
    const drivers = await this.prisma.user.findMany({
      where: { role: Role.DRIVER, accountStatus: { in: ['ADMIN_REVIEW_PENDING','DOCUMENTS_PENDING'] as any[] } },
      include: { driverProfile: true, documents: { orderBy: { uploadedAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return drivers.map(d => ({
      id: d.id, name: d.name, email: d.email, phone: d.phone,
      accountStatus: d.accountStatus, faceVerified: d.faceVerified,
      driverProfile: d.driverProfile,
      documents: d.documents.map(doc => this.mapDocumentForAdmin(doc as any)),
      documentsSummary: {
        pending:  d.documents.filter(doc => doc.status === DocumentStatus.PENDING).length,
        approved: d.documents.filter(doc => doc.status === DocumentStatus.APPROVED).length,
        rejected: d.documents.filter(doc => doc.status === DocumentStatus.REJECTED).length,
      },
      canBeApproved: this.hasAllRequiredApprovedDocuments(d.documents),
    }));
  }

  async getPassengers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.PASSENGER },
        select: { id: true, name: true, email: true, phone: true, role: true, accountStatus: true, createdAt: true, lastLoginAt: true },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      this.prisma.user.count({ where: { role: Role.PASSENGER } }),
    ]);
    return { page, limit, total, items };
  }

  async setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.prisma.user.update({ where: { id: userId }, data: { accountStatus: status as any } });
    return { success: true, accountStatus: status, message: status === 'SUSPENDED' ? 'Compte suspendu' : 'Compte activé' };
  }

  // ─── Documents ───────────────────────────────────────────────────────────────
  async getPendingDocuments() {
    const docs = await this.prisma.document.findMany({
      where: { status: DocumentStatus.PENDING },
      include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
      orderBy: { uploadedAt: 'asc' },
    });
    return docs.map(doc => this.mapDocumentForAdmin(doc as any));
  }

  async getApprovedDocuments() {
    const docs = await this.prisma.document.findMany({
      where: { status: DocumentStatus.APPROVED },
      include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
      orderBy: { reviewedAt: 'desc' },
      take: 300,
    });
    return docs.map(doc => this.mapDocumentForAdmin(doc as any));
  }

  async getDocumentsByStatus(status?: string) {
    const n = (status || '').toUpperCase();
    if (n === 'APPROVED') return this.getApprovedDocuments();
    if (n === 'REJECTED') {
      const docs = await this.prisma.document.findMany({
        where: { status: DocumentStatus.REJECTED },
        include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
        orderBy: { reviewedAt: 'desc' }, take: 300,
      });
      return docs.map(doc => this.mapDocumentForAdmin(doc as any));
    }
    return this.getPendingDocuments();
  }

  async getDocumentDetails(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { user: { select: { id: true, name: true, email: true, phone: true, role: true, accountStatus: true, driverProfile: true } } },
    });
    if (!doc) throw new NotFoundException('Document introuvable');
    return this.mapDocumentForAdmin(doc as any);
  }

  async reviewDocument(params: {
    documentId: string; adminId: string;
    status?: string; approved?: boolean; rejectionReason?: string;
  }) {
    const { documentId, adminId, status, approved, rejectionReason } = params;
    const targetStatus = this.toDocumentStatus(status, approved);

    const doc = await this.prisma.document.findUnique({ where: { id: documentId }, include: { user: true } });
    if (!doc) throw new NotFoundException('Document introuvable');

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: targetStatus,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: targetStatus === DocumentStatus.REJECTED ? (rejectionReason ?? 'Document non conforme') : null,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    if (targetStatus === DocumentStatus.REJECTED) {
      await this.prisma.user.update({
        where: { id: doc.userId },
        data: { accountStatus: 'DOCUMENTS_PENDING' as any },
      }).catch(() => null);
      await this.prisma.driverProfile.updateMany({
        where: { userId: doc.userId },
        data: { adminApproved: false },
      }).catch(() => null);
    } else {
      await this.autoActivateDriverIfReady(doc.userId);
    }

    return {
      ...this.mapDocumentForAdmin(updated as any),
      message: targetStatus === DocumentStatus.APPROVED ? 'Document approuvé ✅' : 'Document rejeté ❌',
    };
  }

  // BUG FIX: Active isVerified=true en même temps que accountStatus=ACTIVE
  private async autoActivateDriverIfReady(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { documents: true, driverProfile: true },
    });
    if (!user || user.role !== Role.DRIVER) return;

    const allApproved = this.hasAllRequiredApprovedDocuments(user.documents);
    const hasVehicleInfo = user.driverProfile?.vehicleMake
      && user.driverProfile?.vehicleModel
      && user.driverProfile?.licensePlate;
    const faceVerified = user.driverProfile?.faceVerified;

    if (allApproved && hasVehicleInfo && faceVerified) {
      // BUG FIX: isVerified doit être true pour permettre la connexion
      await this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus: AccountStatus.ACTIVE, isVerified: true },
      });
      await this.prisma.driverProfile.updateMany({
        where: { userId },
        data: { adminApproved: true, adminApprovedAt: new Date() },
      }).catch(() => null);
      this.ridesGateway.notifyPassenger(userId, 'account_activated', {
        message: 'Votre compte est maintenant actif ! Vous pouvez accepter des courses.',
      });
      console.log(`✅ Chauffeur ${userId} activé automatiquement`);
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus: 'ADMIN_REVIEW_PENDING' as any },
      }).catch(() => null);
    }
  }

  async setDriverApproval(params: { driverId: string; approved: boolean; adminNotes?: string }) {
    const { driverId, approved, adminNotes } = params;
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true, documents: true },
    });
    if (!driver || driver.role !== Role.DRIVER || !driver.driverProfile)
      throw new NotFoundException('Chauffeur introuvable');

    if (approved) {
      // BUG FIX: isVerified=true en même temps que l'activation
      await this.prisma.$transaction([
        this.prisma.driverProfile.update({
          where: { userId: driverId },
          data: { adminApproved: true, adminApprovedAt: new Date(), adminNotes: adminNotes ?? null },
        }),
        this.prisma.user.update({
          where: { id: driverId },
          data: { accountStatus: AccountStatus.ACTIVE, isVerified: true },
        }),
      ]);
      // Notifier le chauffeur en temps réel via socket
      this.ridesGateway.notifyPassenger(driverId, 'account_activated', {
        message: 'Votre compte est maintenant actif ! Vous pouvez accepter des courses.',
      });
      return { success: true, message: 'Chauffeur approuvé et activé ✅' };
    }

    await this.prisma.$transaction([
      this.prisma.driverProfile.update({
        where: { userId: driverId },
        data: { adminApproved: false, adminApprovedAt: null, adminNotes: adminNotes ?? "Refusé par l'administration" },
      }),
      this.prisma.user.update({
        where: { id: driverId },
        data: { accountStatus: AccountStatus.REJECTED, isVerified: false },
      }),
    ]);
    return { success: true, message: 'Chauffeur refusé ❌' };
  }

  // ─── Finances ────────────────────────────────────────────────────────────────
  async getFinanceStats() {
    const [total, recharges, payments, withdrawals, pending] = await Promise.all([
      this.prisma.transaction.count(),
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'RECHARGE', status: 'COMPLETED' } }),
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT',  status: 'COMPLETED' } }),
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'WITHDRAWAL' } }),
      this.prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
    ]);
    return {
      transactionsTotal: total,
      rechargeAmount:    recharges._sum.amount  ?? 0,
      paymentAmount:     Math.abs(payments._sum.amount  ?? 0),
      withdrawalAmount:  Math.abs(withdrawals._sum.amount ?? 0),
      pendingWithdrawals: pending,
    };
  }

  async getFinanceChart(period = 'weekly') {
    const days = period === 'monthly' ? 30 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const txs = await this.prisma.transaction.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, amount: true, type: true },
      orderBy: { createdAt: 'asc' },
    });
    return { period, since, points: txs.map(tx => ({ at: tx.createdAt, amount: tx.amount, type: tx.type })) };
  }

  async getFinanceTransactions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      this.prisma.transaction.count(),
    ]);
    return { page, limit, total, items };
  }

  // ─── Panics ──────────────────────────────────────────────────────────────────
  async getActivePanics() {
    const panics = await this.prisma.notification.findMany({
      where: { type: 'PANIC' },
      include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return panics.map(p => ({ id: p.id, title: p.title, body: p.body, isRead: p.isRead, createdAt: p.createdAt, user: p.user }));
  }

  // ─── Activité ────────────────────────────────────────────────────────────────
  async getLoginActivity() {
    return this.prisma.user.findMany({
      where: { lastLoginAt: { not: null } },
      select: { id: true, name: true, email: true, role: true, accountStatus: true, createdAt: true, lastLoginAt: true },
      orderBy: { lastLoginAt: 'desc' },
      take: 100,
    });
  }

  // ─── Config ──────────────────────────────────────────────────────────────────
  async getConfig() { return { pricing: await this.getPricingConfig(), financials: await this.getFinancialsConfig() }; }
  async updateConfig(_payload: any) { return { success: true }; }
  async getPricingConfig() { return { baseFare: 3.0, pricePerKm: { MOTO: 0.8, ECO: 1.2, CONFORT: 1.5 }, pricePerMinute: 0.3, minimumFare: 5.0, surgeMultiplier: 1.0 }; }
  async updatePricingConfig(payload: any) { return { success: true, data: payload }; }
  async getFinancialsConfig() { return { platformCommission: 20, driverShare: 80, currency: 'XOF' }; }
  async updateFinancialsConfig(payload: any) { return { success: true, data: payload }; }
}
