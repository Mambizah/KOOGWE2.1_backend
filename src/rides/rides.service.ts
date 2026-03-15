import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, RideStatus, VehicleType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RidesGateway } from './rides.gateway';
import { CreateRideDto } from './dto/create-ride.dto';
import { MailService } from '../mail.service';
import { createHmac, randomBytes } from 'crypto';

type EstimateInput = {
  distanceKm: number;
  durationMin: number;
  vehicleType?: string;
  zone?: string;
  horaire?: string;
  trafic?: string;
  meteo?: string;
  demande?: string;
};

@Injectable()
export class RidesService {
  constructor(
    private prisma: PrismaService,
    private ridesGateway: RidesGateway,
    private mailService: MailService,
  ) {}

  estimatePrice(input: EstimateInput) {
    const distanceKm = Number(input.distanceKm);
    const durationMin = Number(input.durationMin);

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      throw new BadRequestException('distanceKm invalide');
    }
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      throw new BadRequestException('durationMin invalide');
    }

    const rideType = (input.vehicleType ?? 'ECO').toUpperCase();

    const pickupFee = Number(process.env.PRICING_PICKUP_FEE ?? 3);
    const minuteRate = Number(process.env.PRICING_MINUTE_RATE ?? 0.3);
    const minPrice = Number(process.env.PRICING_MIN_PRICE ?? 7);
    const maxSurge = Number(process.env.PRICING_MAX_SURGE ?? 3);

    const perKmByVehicle: Record<string, number> = {
      MOTO: Number(process.env.PRICING_KM_MOTO ?? 1.0),
      ECO: Number(process.env.PRICING_KM_ECO ?? 1.2),
      CONFORT: Number(process.env.PRICING_KM_CONFORT ?? 1.5),
      VAN: Number(process.env.PRICING_KM_VAN ?? 1.9),
    };

    const zoneCoeff: Record<string, number> = {
      normal: 1,
      centre: 1.2,
      rural: 0.9,
      aeroport: 1.4,
    };

    const horaireCoeff: Record<string, number> = {
      creuse: 1,
      normal: 1.1,
      pointe: 1.3,
      nuit: 1.4,
    };

    const traficCoeff: Record<string, number> = {
      fluide: 1,
      modere: 1.1,
      dense: 1.25,
      bloque: 1.4,
    };

    const meteoCoeff: Record<string, number> = {
      normale: 1,
      pluie: 1.1,
      forte_pluie: 1.2,
      tempete: 1.4,
    };

    const demandeCoeff: Record<string, number> = {
      normale: 1,
      forte: 1.2,
      tres_forte: 1.5,
      critique: 2,
    };

    const kmRate = perKmByVehicle[rideType] ?? perKmByVehicle.ECO;
    const base = pickupFee + distanceKm * kmRate + durationMin * minuteRate;

    const coefficients = {
      zone: zoneCoeff[(input.zone ?? 'normal').toLowerCase()] ?? 1,
      horaire: horaireCoeff[(input.horaire ?? 'normal').toLowerCase()] ?? 1,
      trafic: traficCoeff[(input.trafic ?? 'fluide').toLowerCase()] ?? 1,
      meteo: meteoCoeff[(input.meteo ?? 'normale').toLowerCase()] ?? 1,
      demande: demandeCoeff[(input.demande ?? 'normale').toLowerCase()] ?? 1,
    };

    const surgeRaw = coefficients.zone * coefficients.horaire * coefficients.trafic * coefficients.meteo * coefficients.demande;
    const surgeApplied = Math.min(surgeRaw, maxSurge);
    const estimatedPrice = Math.max(Number((base * surgeApplied).toFixed(2)), minPrice);

    return {
      distanceKm,
      durationMin,
      vehicleType: rideType,
      breakdown: {
        pickupFee,
        kmRate,
        minuteRate,
        base: Number(base.toFixed(2)),
        coefficients,
        surgeRaw: Number(surgeRaw.toFixed(3)),
        surgeApplied: Number(surgeApplied.toFixed(3)),
      },
      estimatedPrice,
      currency: 'EUR',
    };
  }

  async create(createRideDto: CreateRideDto, passengerId: string) {
    const newRide = await this.prisma.ride.create({
      data: {
        passengerId,
        originLat: Number(createRideDto.originLat),
        originLng: Number(createRideDto.originLng),
        destLat: Number(createRideDto.destLat),
        destLng: Number(createRideDto.destLng),
        distance: createRideDto.distance ? Number(createRideDto.distance) : null,
        duration: createRideDto.duration ? Math.round(Number(createRideDto.duration)) : null,
        price: Number(createRideDto.price),
        paymentMethod: createRideDto.paymentMethod ?? PaymentMethod.CASH,
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

    if (newRide.passenger?.email) {
      await this.mailService.sendRideValidationEmail(newRide.passenger.email, {
        rideId: newRide.id,
        status: newRide.status,
        price: newRide.price,
        vehicleType: newRide.vehicleType,
      });
    }

    return newRide;
  }

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
      passengerRating: ride.passengerRating,
      driverRating: ride.driverRating,
      passenger: ride.passenger ? { id: ride.passenger.id, name: ride.passenger.name } : null,
      driver: ride.driver ? { id: ride.driver.id, name: ride.driver.name } : null,
      name: role === 'DRIVER' ? (ride.passenger?.name ?? 'Passager') : (ride.driver?.name ?? 'Chauffeur'),
      date: ride.requestedAt.toLocaleDateString('fr-FR'),
    }));
  }

  async getDriverStats(driverId: string) {
    const now = new Date();

    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [dayRides, weekRides, monthRides, yearRides, allRides] = await Promise.all([
      this.prisma.ride.findMany({ where: { driverId, status: RideStatus.COMPLETED, requestedAt: { gte: startOfDay } } }),
      this.prisma.ride.findMany({ where: { driverId, status: RideStatus.COMPLETED, requestedAt: { gte: startOfWeek } } }),
      this.prisma.ride.findMany({ where: { driverId, status: RideStatus.COMPLETED, requestedAt: { gte: startOfMonth } } }),
      this.prisma.ride.findMany({ where: { driverId, status: RideStatus.COMPLETED, requestedAt: { gte: startOfYear } } }),
      this.prisma.ride.findMany({ where: { driverId, status: RideStatus.COMPLETED } }),
    ]);

    const sum = (rides: any[]) => rides.reduce((acc, ride) => acc + ride.price, 0);
    const estimatedMinutesPerRide = 20;
    const totalMinutes = allRides.length * estimatedMinutesPerRide;
    const monthMinutes = monthRides.length * estimatedMinutesPerRide;

    const zoneMap: Record<string, { lat: number; lng: number; count: number }> = {};
    for (const ride of allRides) {
      const zLat = Math.round(ride.originLat * 100) / 100;
      const zLng = Math.round(ride.originLng * 100) / 100;
      const key = `${zLat}_${zLng}`;
      if (!zoneMap[key]) zoneMap[key] = { lat: zLat, lng: zLng, count: 0 };
      zoneMap[key].count++;
    }

    const cashRides = allRides.filter((ride) => ride.paymentMethod === PaymentMethod.CASH);
    const walletRides = allRides.filter((ride) => ride.paymentMethod === PaymentMethod.WALLET);

    const last30Days: { date: string; revenue: number; rides: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);
      const dayRidesData = allRides.filter((ride) => {
        const rideDate = new Date(ride.requestedAt);
        return rideDate >= d && rideDate <= dEnd;
      });

      last30Days.push({
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        revenue: parseFloat(sum(dayRidesData).toFixed(2)),
        rides: dayRidesData.length,
      });
    }

    return {
      dailyEarnings: parseFloat(sum(dayRides).toFixed(2)),
      weeklyEarnings: parseFloat(sum(weekRides).toFixed(2)),
      monthlyEarnings: parseFloat(sum(monthRides).toFixed(2)),
      yearlyEarnings: parseFloat(sum(yearRides).toFixed(2)),
      totalEarnings: parseFloat(sum(allRides).toFixed(2)),
      todayRides: dayRides.length,
      weekRides: weekRides.length,
      monthRides: monthRides.length,
      totalRides: allRides.length,
      totalHours: Math.floor(totalMinutes / 60),
      monthHours: Math.floor(monthMinutes / 60),
      cashRides: cashRides.length,
      walletRides: walletRides.length,
      cashEarnings: parseFloat(sum(cashRides).toFixed(2)),
      walletEarnings: parseFloat(sum(walletRides).toFixed(2)),
      last30Days,
      hotZones: Object.values(zoneMap).sort((a, b) => b.count - a.count).slice(0, 10),
    };
  }

  async getActiveCourses() {
    return this.prisma.ride.findMany({
      where: { status: { in: [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS] } },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async acceptRide(rideId: string, driverId: string) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true },
    });

    if (!driver || driver.role !== 'DRIVER' || !driver.driverProfile) {
      throw new ForbiddenException('Chauffeur invalide');
    }

    const hasVehicleInfo = Boolean(
      driver.driverProfile.vehicleMake
      && driver.driverProfile.vehicleModel
      && driver.driverProfile.licensePlate,
    );

    const canAccept = driver.driverProfile.faceVerified
      && driver.driverProfile.documentsUploaded
      && driver.driverProfile.adminApproved
      && hasVehicleInfo;
    if (!canAccept) {
      throw new ForbiddenException('Compte chauffeur incomplet: vérification, documents, véhicule et validation admin requis');
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== RideStatus.REQUESTED) {
      throw new BadRequestException('Course non disponible');
    }

    // BUG FIX 5: Vérifier que le type de véhicule du chauffeur correspond
    const driverVehicleType = (driver.driverProfile.vehicleType ?? 'MOTO').toUpperCase();
    const rideVehicleType = (ride.vehicleType ?? 'MOTO').toUpperCase();
    if (driverVehicleType !== rideVehicleType) {
      throw new BadRequestException(
        \`Type de véhicule incompatible : le passager a demandé \${rideVehicleType}, votre véhicule est \${driverVehicleType}\`
      );
    }

    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: { driverId, status: RideStatus.ACCEPTED, acceptedAt: new Date() },
      include: {
        passenger: { select: { id: true, name: true, phone: true, email: true } },
        driver: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    this.ridesGateway.notifyPassenger(updated.passengerId, 'ride_accepted', updated);

    if (updated.passenger?.email && updated.driver) {
      await this.mailService.sendDriverAssignedEmail(updated.passenger.email, {
        rideId: updated.id,
        driverName: updated.driver.name ?? 'Chauffeur',
        driverPhone: updated.driver.phone ?? undefined,
      });
    }

    return updated;
  }

  async updateStatus(rideId: string, driverId: string, status: RideStatus) {
    const existing = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!existing) throw new NotFoundException('Course introuvable');
    if (existing.driverId && existing.driverId !== driverId) {
      throw new ForbiddenException('Seul le chauffeur assigné peut modifier la course');
    }

    const now = new Date();
    const data: any = { status };
    if (status === RideStatus.ARRIVED) data.arrivedAt = now;
    if (status === RideStatus.IN_PROGRESS) data.startedAt = now;
    if (status === RideStatus.COMPLETED) {
      data.completedAt = now;
      if (existing.paymentMethod === PaymentMethod.CARD) {
        data.isPaid = true;
      }
    }

    const ride = await this.prisma.ride.update({
      where: { id: rideId },
      data,
      include: {
        passenger: { select: { id: true, email: true } },
        driver: { select: { id: true, name: true, email: true } },
      },
    });

    const event = status === RideStatus.COMPLETED
      ? 'ride_completed'
      : status === RideStatus.IN_PROGRESS
        ? 'ride_started'
        : status === RideStatus.ARRIVED
          ? 'driver_arrived'
          : 'ride_updated';

    this.ridesGateway.notifyPassenger(ride.passenger.id, event, ride);

    if (status === RideStatus.COMPLETED && ride.driverId) {
      await this.prisma.driverProfile.update({
        where: { userId: ride.driverId },
        data: {
          totalRides: { increment: 1 },
          totalEarnings: { increment: ride.price },
        },
      });
    }

    if (status === RideStatus.COMPLETED && ride.passenger.email) {
      await this.mailService.sendRideCompletedEmail(ride.passenger.email, {
        rideId: ride.id,
        price: ride.price,
      });
    }

    return ride;
  }

  async cancelRide(rideId: string, userId: string, role: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        passenger: { select: { id: true, email: true } },
        driver: { select: { id: true, email: true } },
      },
    });

    if (!ride) throw new NotFoundException('Course introuvable');
    const cancellableStatuses: RideStatus[] = [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.ARRIVED];
    if (!cancellableStatuses.includes(ride.status)) {
      throw new BadRequestException('Cette course ne peut plus être annulée');
    }

    if (role === 'PASSENGER' && ride.passengerId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas annuler cette course');
    }
    if (role === 'DRIVER' && ride.driverId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas annuler cette course');
    }

    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: {
        passenger: { select: { id: true, email: true } },
        driver: { select: { id: true, email: true } },
      },
    });

    const cancelPayload = {
      rideId,
      cancelledBy: role,
      status: RideStatus.CANCELLED,
      passengerName: updated.passenger?.name,
      driverName: updated.driver?.name,
    };

    // Notifier la room
    this.ridesGateway.notifyRideRoom(rideId, 'ride_cancelled', cancelPayload);

    // BUG FIX 4: Notifier le chauffeur DIRECTEMENT via sa room personnelle
    // (le chauffeur peut ne pas être dans join_ride au moment de l'annulation)
    if (updated.driverId) {
      this.ridesGateway.notifyPassenger(updated.driverId, 'ride_cancelled', cancelPayload);
    }
    // Notifier aussi le passager si c'est le chauffeur qui annule
    if (updated.passengerId && role === 'DRIVER') {
      this.ridesGateway.notifyPassenger(updated.passengerId, 'ride_cancelled', cancelPayload);
    }

    if (updated.passenger?.email) {
      await this.mailService.sendRideCancelledEmail(updated.passenger.email, { rideId: updated.id });
    }
    if (updated.driver?.email) {
      await this.mailService.sendRideCancelledEmail(updated.driver.email, { rideId: updated.id });
    }

    return updated;
  }

  async rateRide(rideId: string, userId: string, role: string, rating: number, comment?: string) {
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('La note doit être comprise entre 1 et 5');
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('La notation est disponible après la fin de course');
    }

    if (role === 'PASSENGER') {
      if (ride.passengerId !== userId) {
        throw new ForbiddenException('Vous ne pouvez pas noter cette course');
      }
      return this.prisma.ride.update({
        where: { id: rideId },
        data: {
          driverRating: rating,
          passengerComment: comment,
        },
      });
    }

    if (role === 'DRIVER') {
      if (ride.driverId !== userId) {
        throw new ForbiddenException('Vous ne pouvez pas noter cette course');
      }
      return this.prisma.ride.update({
        where: { id: rideId },
        data: {
          passengerRating: rating,
          driverComment: comment,
        },
      });
    }

    throw new ForbiddenException('Rôle non autorisé');
  }

  async createScheduledRide(passengerId: string, data: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    price: number;
    vehicleType: string;
    paymentMethod?: PaymentMethod;
    originAddress?: string;
    destAddress?: string;
    scheduledAt: string;
  }) {
    const scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new BadRequestException('La date doit être dans le futur');
    }

    const ride = await this.create(
      {
        originLat: Number(data.originLat),
        originLng: Number(data.originLng),
        destLat: Number(data.destLat),
        destLng: Number(data.destLng),
        price: Number(data.price),
        vehicleType: (data.vehicleType as VehicleType) ?? VehicleType.MOTO,
        paymentMethod: data.paymentMethod ?? PaymentMethod.CASH,
        originAddress: data.originAddress,
        destAddress: data.destAddress,
      },
      passengerId,
    );

    return { ...ride, isScheduled: true, scheduledAt };
  }

  async generateShareToken(rideId: string, passengerId: string): Promise<{ shareToken: string; shareUrl: string }> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.passengerId !== passengerId) {
      throw new ForbiddenException('Course introuvable ou non autorisée');
    }

    const nonce = randomBytes(6).toString('hex');
    const payload = `${rideId}.${Date.now()}.${nonce}`;
    const secret = process.env.RIDE_SHARE_SECRET || process.env.JWT_SECRET || 'koogwe-share-secret';
    const signature = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
    const token = Buffer.from(`${payload}.${signature}`).toString('base64url');
    const shareUrl = `${process.env.FRONTEND_URL || 'https://koogwe.com'}/track/${token}`;

    return { shareToken: token, shareUrl };
  }

  async getRideByShareToken(token: string) {
    let decoded = '';
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('Lien de partage invalide');
    }

    const [rideId, timestamp, nonce, signature] = decoded.split('.');
    if (!rideId || !timestamp || !nonce || !signature) {
      throw new BadRequestException('Lien de partage invalide');
    }

    const payload = `${rideId}.${timestamp}.${nonce}`;
    const secret = process.env.RIDE_SHARE_SECRET || process.env.JWT_SECRET || 'koogwe-share-secret';
    const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
    if (signature !== expectedSignature) {
      throw new BadRequestException('Lien de partage invalide');
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        passenger: { select: { name: true } },
        driver: { select: { name: true } },
      },
    });
    if (!ride) throw new NotFoundException('Course introuvable');

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

  async triggerPanic(userId: string, rideId: string | null, lat: number, lng: number) {
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'PANIC',
        title: '🚨 Bouton panique activé',
        body: `Alerte panique ride=${rideId ?? 'N/A'} position=${lat},${lng}`,
      },
    });

    this.ridesGateway.notifyRideRoom(rideId ?? 'global', 'panic_alert', { userId, rideId, lat, lng });
    return { success: true, message: 'Alerte envoyée' };
  }

  async addFavoriteDriver(passengerId: string, driverId: string) {
    const driver = await this.prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || driver.role !== 'DRIVER') {
      throw new NotFoundException('Chauffeur introuvable');
    }

    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: passengerId,
        type: 'FAVORITE_DRIVER',
        title: driverId,
      },
    });

    if (!existing) {
      await this.prisma.notification.create({
        data: {
          userId: passengerId,
          type: 'FAVORITE_DRIVER',
          title: driverId,
          body: driver.name ?? 'Chauffeur',
        },
      });
    }

    return { success: true, message: 'Chauffeur ajouté aux favoris' };
  }

  async removeFavoriteDriver(passengerId: string, driverId: string) {
    await this.prisma.notification.deleteMany({
      where: {
        userId: passengerId,
        type: 'FAVORITE_DRIVER',
        title: driverId,
      },
    });

    return { success: true };
  }

  async getFavoriteDrivers(passengerId: string) {
    const favorites = await this.prisma.notification.findMany({
      where: {
        userId: passengerId,
        type: 'FAVORITE_DRIVER',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!favorites.length) return [];
    const driverIds = favorites.map((item) => item.title);

    const drivers = await this.prisma.user.findMany({
      where: { id: { in: driverIds }, role: 'DRIVER' },
      include: { driverProfile: true },
    });

    return drivers.map((driver) => ({
      driverId: driver.id,
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.driverProfile
        ? {
            vehicleMake: driver.driverProfile.vehicleMake,
            vehicleModel: driver.driverProfile.vehicleModel,
            vehicleColor: driver.driverProfile.vehicleColor,
          }
        : null,
    }));
  }
}
