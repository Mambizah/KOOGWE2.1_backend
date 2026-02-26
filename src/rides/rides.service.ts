import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RidesGateway } from './rides.gateway';
import { CreateRideDto } from './dto/create-ride.dto';
import { RideStatus, VehicleType } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class RidesService {
  constructor(
    private prisma: PrismaService,
    private ridesGateway: RidesGateway,
  ) {}

  // ── CRÉER UNE COURSE ──────────────────────────────────────────────────────
  async create(createRideDto: CreateRideDto, passengerId: string) {
    const newRide = await this.prisma.ride.create({
      data: {
        passengerId,
        originLat: Number(createRideDto.originLat),
        originLng: Number(createRideDto.originLng),
        destLat: Number(createRideDto.destLat),
        destLng: Number(createRideDto.destLng),
        price: Number(createRideDto.price),
        vehicleType: createRideDto.vehicleType ?? VehicleType.MOTO,
        originAddress: createRideDto.originAddress,
        destAddress: createRideDto.destAddress,
        status: RideStatus.REQUESTED,
      },
      include: {
        passenger: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
    this.ridesGateway.notifyDrivers(newRide);
    return newRide;
  }

  // ── HISTORIQUE ────────────────────────────────────────────────────────────
  async getHistory(userId: string, role: string) {
    const where = role === 'DRIVER'
      ? { driverId: userId, status: RideStatus.COMPLETED }
      : { passengerId: userId };

    const rides = await this.prisma.ride.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      take: 50,
      include: {
        passenger: { select: { id: true, name: true, email: true, phone: true } },
        driver: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    return rides.map((ride) => ({
      id: ride.id,
      price: ride.price,
      status: ride.status,
      vehicleType: ride.vehicleType,
      requestedAt: ride.requestedAt,
      originLat: ride.originLat,
      originLng: ride.originLng,
      destLat: ride.destLat,
      destLng: ride.destLng,
      paymentMethod: ride.paymentMethod,
      isPaid: ride.isPaid,
      passenger: ride.passenger ? { id: ride.passenger.id, name: ride.passenger.name } : null,
      driver: ride.driver ? { id: ride.driver.id, name: ride.driver.name } : null,
      name: role === 'DRIVER' ? (ride.passenger?.name ?? 'Passager') : (ride.driver?.name ?? 'Chauffeur'),
      date: ride.requestedAt.toLocaleDateString('fr-FR'),
    }));
  }

  // ── STATS CHAUFFEUR COMPLÈTES ──────────────────────────────────────────────
  async getDriverStats(driverId: string) {
    const now = new Date();

    // Bornes temporelles
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [dayRides, weekRides, monthRides, yearRides, allRides] = await Promise.all([
      this.prisma.ride.findMany({ where: { driverId, status: 'COMPLETED', requestedAt: { gte: startOfDay } } }),
      this.prisma.ride.findMany({ where: { driverId, status: 'COMPLETED', requestedAt: { gte: startOfWeek } } }),
      this.prisma.ride.findMany({ where: { driverId, status: 'COMPLETED', requestedAt: { gte: startOfMonth } } }),
      this.prisma.ride.findMany({ where: { driverId, status: 'COMPLETED', requestedAt: { gte: startOfYear } } }),
      this.prisma.ride.findMany({ where: { driverId, status: 'COMPLETED' } }),
    ]);

    // Revenus
    const sum = (rides: any[]) => rides.reduce((s, r) => s + r.price, 0);

    // Heures de travail (estimation : 15 min par course en moyenne)
    const estimatedMinutesPerRide = 20;
    const totalMinutes = allRides.length * estimatedMinutesPerRide;
    const totalHours = Math.floor(totalMinutes / 60);
    const monthMinutes = monthRides.length * estimatedMinutesPerRide;
    const monthHours = Math.floor(monthMinutes / 60);

    // Zone chaude — regrouper les origins par zone 0.01° (~1km)
    const zoneMap: Record<string, { lat: number; lng: number; count: number }> = {};
    for (const ride of allRides) {
      const zLat = Math.round(ride.originLat * 100) / 100;
      const zLng = Math.round(ride.originLng * 100) / 100;
      const key = `${zLat}_${zLng}`;
      if (!zoneMap[key]) zoneMap[key] = { lat: zLat, lng: zLng, count: 0 };
      zoneMap[key].count++;
    }
    const hotZones = Object.values(zoneMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cash vs Wallet
    const cashRides = allRides.filter(r => r.paymentMethod === 'CASH');
    const walletRides = allRides.filter(r => r.paymentMethod === 'WALLET');

    // Revenus par jour (30 derniers jours pour le graphe)
    const last30Days: { date: string; revenue: number; rides: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);
      const dayR = allRides.filter(r => {
        const rd = new Date(r.requestedAt);
        return rd >= d && rd <= dEnd;
      });
      last30Days.push({
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        revenue: parseFloat(sum(dayR).toFixed(2)),
        rides: dayR.length,
      });
    }

    return {
      // Revenus
      dailyEarnings: parseFloat(sum(dayRides).toFixed(2)),
      weeklyEarnings: parseFloat(sum(weekRides).toFixed(2)),
      monthlyEarnings: parseFloat(sum(monthRides).toFixed(2)),
      yearlyEarnings: parseFloat(sum(yearRides).toFixed(2)),
      totalEarnings: parseFloat(sum(allRides).toFixed(2)),
      // Courses
      todayRides: dayRides.length,
      weekRides: weekRides.length,
      monthRides: monthRides.length,
      totalRides: allRides.length,
      // Heures
      totalHours,
      monthHours,
      // Paiements
      cashRides: cashRides.length,
      walletRides: walletRides.length,
      cashEarnings: parseFloat(sum(cashRides).toFixed(2)),
      walletEarnings: parseFloat(sum(walletRides).toFixed(2)),
      // Graphe
      last30Days,
      // Zones chaudes
      hotZones,
    };
  }

  // ── COURSES ACTIVES ────────────────────────────────────────────────────────
  async getActiveCourses() {
    return this.prisma.ride.findMany({
      where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  // ── ACCEPTER UNE COURSE ────────────────────────────────────────────────────
  async acceptRide(rideId: string, driverId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== 'REQUESTED') throw new Error('Course non disponible');

    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: { driverId, status: RideStatus.ACCEPTED },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
    });
    this.ridesGateway.notifyPassenger(updated.passengerId, 'ride_accepted', updated);
    return updated;
  }

  // ── METTRE À JOUR LE STATUT ────────────────────────────────────────────────
  async updateStatus(rideId: string, driverId: string, status: RideStatus) {
    const ride = await this.prisma.ride.update({
      where: { id: rideId },
      data: { status },
      include: { passenger: { select: { id: true } } },
    });
    const event = status === RideStatus.COMPLETED ? 'ride_completed'
      : status === RideStatus.IN_PROGRESS ? 'ride_started'
      : status === RideStatus.ARRIVED ? 'driver_arrived'
      : 'ride_updated';
    this.ridesGateway.notifyPassenger(ride.passenger.id, event, ride);
    return ride;
  }

  // ── COURSE PROGRAMMÉE ──────────────────────────────────────────────────────
  async createScheduledRide(passengerId: string, data: {
    originLat: number; originLng: number;
    destLat: number; destLng: number;
    price: number; vehicleType: string;
    originAddress?: string; destAddress?: string;
    scheduledAt: string;
  }) {
    const scheduledAt = new Date(data.scheduledAt);
    if (scheduledAt <= new Date()) throw new Error('La date doit être dans le futur');

    const ride = await this.prisma.ride.create({
      data: {
        passengerId,
        originLat: data.originLat,
        originLng: data.originLng,
        destLat: data.destLat,
        destLng: data.destLng,
        price: data.price,
        vehicleType: data.vehicleType as VehicleType,
        originAddress: data.originAddress,
        destAddress: data.destAddress,
        status: RideStatus.REQUESTED,
        scheduledAt,
      },
    });
    return { ...ride, isScheduled: true, scheduledAt };
  }

  // ── PARTAGE DE TRAJET ──────────────────────────────────────────────────────
  async generateShareToken(rideId: string, passengerId: string): Promise<{ shareToken: string; shareUrl: string }> {
    const token = randomBytes(16).toString('hex');
    await this.prisma.ride.update({
      where: { id: rideId, passengerId },
      data: { shareToken: token },
    });
    const shareUrl = `${process.env.FRONTEND_URL || 'https://koogwe.com'}/track/${token}`;
    return { shareToken: token, shareUrl };
  }

  async getRideByShareToken(token: string) {
    const ride = await this.prisma.ride.findFirst({
      where: { shareToken: token },
      include: {
        passenger: { select: { name: true } },
        driver: { select: { name: true } },
      },
    });
    if (!ride) throw new Error('Lien de partage invalide ou expiré');
    return {
      id: ride.id,
      status: ride.status,
      originLat: ride.originLat,
      originLng: ride.originLng,
      destLat: ride.destLat,
      destLng: ride.destLng,
      originAddress: ride.originAddress,
      destAddress: ride.destAddress,
      passengerName: ride.passenger?.name,
      driverName: ride.driver?.name,
      price: ride.price,
    };
  }

  // ── BOUTON PANIQUE ────────────────────────────────────────────────────────
  async triggerPanic(userId: string, rideId: string | null, lat: number, lng: number) {
    console.log(`🚨 PANIQUE userId=${userId} rideId=${rideId} position=${lat},${lng}`);

    // Créer une notification admin
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'PANIC',
        title: '🚨 Bouton panique activé',
        body: `Utilisateur ${userId} a activé le bouton panique à ${lat},${lng}`,
        data: JSON.stringify({ rideId, lat, lng, timestamp: new Date().toISOString() }),
      },
    });

    // Notifier tous les admins via WebSocket
    this.ridesGateway.notifyAdmins('panic_alert', { userId, rideId, lat, lng });

    return { success: true, message: 'Alerte envoyée. Secours notifiés.' };
  }

  // ── CHAUFFEUR FAVORI ──────────────────────────────────────────────────────
  async addFavoriteDriver(passengerId: string, driverId: string) {
    // Vérifier que le chauffeur existe
    const driver = await this.prisma.user.findUnique({ where: { id: driverId, role: 'DRIVER' } });
    if (!driver) throw new Error('Chauffeur introuvable');

    try {
      await this.prisma.favoriteDriver.create({
        data: { passengerId, driverId },
      });
    } catch (_) { /* déjà favori */ }

    return { success: true, message: `${driver.name} ajouté aux favoris` };
  }

  async removeFavoriteDriver(passengerId: string, driverId: string) {
    await this.prisma.favoriteDriver.deleteMany({ where: { passengerId, driverId } });
    return { success: true };
  }

  async getFavoriteDrivers(passengerId: string) {
    const favorites = await this.prisma.favoriteDriver.findMany({
      where: { passengerId },
      include: {
        driver: {
          select: { id: true, name: true, phone: true, driverProfile: { select: { vehicleMake: true, vehicleModel: true, vehicleColor: true } } },
        },
      },
    });
    return favorites.map(f => ({
      driverId: f.driver.id,
      name: f.driver.name,
      phone: f.driver.phone,
      vehicle: f.driver.driverProfile,
      addedAt: f.createdAt,
    }));
  }
}