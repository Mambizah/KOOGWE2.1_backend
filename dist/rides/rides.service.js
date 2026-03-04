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
exports.RidesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma.service");
const rides_gateway_1 = require("./rides.gateway");
const mail_service_1 = require("../mail.service");
const crypto_1 = require("crypto");
let RidesService = class RidesService {
    constructor(prisma, ridesGateway, mailService) {
        this.prisma = prisma;
        this.ridesGateway = ridesGateway;
        this.mailService = mailService;
    }
    estimatePrice(input) {
        const distanceKm = Number(input.distanceKm);
        const durationMin = Number(input.durationMin);
        if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
            throw new common_1.BadRequestException('distanceKm invalide');
        }
        if (!Number.isFinite(durationMin) || durationMin <= 0) {
            throw new common_1.BadRequestException('durationMin invalide');
        }
        const rideType = (input.vehicleType ?? 'ECO').toUpperCase();
        const pickupFee = Number(process.env.PRICING_PICKUP_FEE ?? 3);
        const minuteRate = Number(process.env.PRICING_MINUTE_RATE ?? 0.3);
        const minPrice = Number(process.env.PRICING_MIN_PRICE ?? 7);
        const maxSurge = Number(process.env.PRICING_MAX_SURGE ?? 3);
        const perKmByVehicle = {
            MOTO: Number(process.env.PRICING_KM_MOTO ?? 1.0),
            ECO: Number(process.env.PRICING_KM_ECO ?? 1.2),
            CONFORT: Number(process.env.PRICING_KM_CONFORT ?? 1.5),
            VAN: Number(process.env.PRICING_KM_VAN ?? 1.9),
        };
        const zoneCoeff = {
            normal: 1,
            centre: 1.2,
            rural: 0.9,
            aeroport: 1.4,
        };
        const horaireCoeff = {
            creuse: 1,
            normal: 1.1,
            pointe: 1.3,
            nuit: 1.4,
        };
        const traficCoeff = {
            fluide: 1,
            modere: 1.1,
            dense: 1.25,
            bloque: 1.4,
        };
        const meteoCoeff = {
            normale: 1,
            pluie: 1.1,
            forte_pluie: 1.2,
            tempete: 1.4,
        };
        const demandeCoeff = {
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
    async create(createRideDto, passengerId) {
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
                paymentMethod: createRideDto.paymentMethod ?? client_1.PaymentMethod.CASH,
                vehicleType: createRideDto.vehicleType ?? client_1.VehicleType.MOTO,
                originAddress: createRideDto.originAddress,
                destAddress: createRideDto.destAddress,
                status: client_1.RideStatus.REQUESTED,
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
    async getHistory(userId, role) {
        const where = role === 'DRIVER'
            ? { driverId: userId, status: client_1.RideStatus.COMPLETED }
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
    async getDriverStats(driverId) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const [dayRides, weekRides, monthRides, yearRides, allRides] = await Promise.all([
            this.prisma.ride.findMany({ where: { driverId, status: client_1.RideStatus.COMPLETED, requestedAt: { gte: startOfDay } } }),
            this.prisma.ride.findMany({ where: { driverId, status: client_1.RideStatus.COMPLETED, requestedAt: { gte: startOfWeek } } }),
            this.prisma.ride.findMany({ where: { driverId, status: client_1.RideStatus.COMPLETED, requestedAt: { gte: startOfMonth } } }),
            this.prisma.ride.findMany({ where: { driverId, status: client_1.RideStatus.COMPLETED, requestedAt: { gte: startOfYear } } }),
            this.prisma.ride.findMany({ where: { driverId, status: client_1.RideStatus.COMPLETED } }),
        ]);
        const sum = (rides) => rides.reduce((acc, ride) => acc + ride.price, 0);
        const estimatedMinutesPerRide = 20;
        const totalMinutes = allRides.length * estimatedMinutesPerRide;
        const monthMinutes = monthRides.length * estimatedMinutesPerRide;
        const zoneMap = {};
        for (const ride of allRides) {
            const zLat = Math.round(ride.originLat * 100) / 100;
            const zLng = Math.round(ride.originLng * 100) / 100;
            const key = `${zLat}_${zLng}`;
            if (!zoneMap[key])
                zoneMap[key] = { lat: zLat, lng: zLng, count: 0 };
            zoneMap[key].count++;
        }
        const cashRides = allRides.filter((ride) => ride.paymentMethod === client_1.PaymentMethod.CASH);
        const walletRides = allRides.filter((ride) => ride.paymentMethod === client_1.PaymentMethod.WALLET);
        const last30Days = [];
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
            where: { status: { in: [client_1.RideStatus.REQUESTED, client_1.RideStatus.ACCEPTED, client_1.RideStatus.ARRIVED, client_1.RideStatus.IN_PROGRESS] } },
            include: {
                passenger: { select: { id: true, name: true, phone: true } },
                driver: { select: { id: true, name: true, phone: true } },
            },
            orderBy: { requestedAt: 'desc' },
        });
    }
    async acceptRide(rideId, driverId) {
        const driver = await this.prisma.user.findUnique({
            where: { id: driverId },
            include: { driverProfile: true },
        });
        if (!driver || driver.role !== 'DRIVER' || !driver.driverProfile) {
            throw new common_1.ForbiddenException('Chauffeur invalide');
        }
        const hasVehicleInfo = Boolean(driver.driverProfile.vehicleMake
            && driver.driverProfile.vehicleModel
            && driver.driverProfile.licensePlate);
        const canAccept = driver.driverProfile.faceVerified
            && driver.driverProfile.documentsUploaded
            && driver.driverProfile.adminApproved
            && hasVehicleInfo;
        if (!canAccept) {
            throw new common_1.ForbiddenException('Compte chauffeur incomplet: vérification, documents, véhicule et validation admin requis');
        }
        const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
        if (!ride || ride.status !== client_1.RideStatus.REQUESTED) {
            throw new common_1.BadRequestException('Course non disponible');
        }
        const updated = await this.prisma.ride.update({
            where: { id: rideId },
            data: { driverId, status: client_1.RideStatus.ACCEPTED, acceptedAt: new Date() },
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
    async updateStatus(rideId, driverId, status) {
        const existing = await this.prisma.ride.findUnique({ where: { id: rideId } });
        if (!existing)
            throw new common_1.NotFoundException('Course introuvable');
        if (existing.driverId && existing.driverId !== driverId) {
            throw new common_1.ForbiddenException('Seul le chauffeur assigné peut modifier la course');
        }
        const now = new Date();
        const data = { status };
        if (status === client_1.RideStatus.ARRIVED)
            data.arrivedAt = now;
        if (status === client_1.RideStatus.IN_PROGRESS)
            data.startedAt = now;
        if (status === client_1.RideStatus.COMPLETED) {
            data.completedAt = now;
            if (existing.paymentMethod === client_1.PaymentMethod.CARD) {
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
        const event = status === client_1.RideStatus.COMPLETED
            ? 'ride_completed'
            : status === client_1.RideStatus.IN_PROGRESS
                ? 'ride_started'
                : status === client_1.RideStatus.ARRIVED
                    ? 'driver_arrived'
                    : 'ride_updated';
        this.ridesGateway.notifyPassenger(ride.passenger.id, event, ride);
        if (status === client_1.RideStatus.COMPLETED && ride.driverId) {
            await this.prisma.driverProfile.update({
                where: { userId: ride.driverId },
                data: {
                    totalRides: { increment: 1 },
                    totalEarnings: { increment: ride.price },
                },
            });
        }
        if (status === client_1.RideStatus.COMPLETED && ride.passenger.email) {
            await this.mailService.sendRideCompletedEmail(ride.passenger.email, {
                rideId: ride.id,
                price: ride.price,
            });
        }
        return ride;
    }
    async cancelRide(rideId, userId, role) {
        const ride = await this.prisma.ride.findUnique({
            where: { id: rideId },
            include: {
                passenger: { select: { id: true, email: true } },
                driver: { select: { id: true, email: true } },
            },
        });
        if (!ride)
            throw new common_1.NotFoundException('Course introuvable');
        const cancellableStatuses = [client_1.RideStatus.REQUESTED, client_1.RideStatus.ACCEPTED, client_1.RideStatus.ARRIVED];
        if (!cancellableStatuses.includes(ride.status)) {
            throw new common_1.BadRequestException('Cette course ne peut plus être annulée');
        }
        if (role === 'PASSENGER' && ride.passengerId !== userId) {
            throw new common_1.ForbiddenException('Vous ne pouvez pas annuler cette course');
        }
        if (role === 'DRIVER' && ride.driverId !== userId) {
            throw new common_1.ForbiddenException('Vous ne pouvez pas annuler cette course');
        }
        const updated = await this.prisma.ride.update({
            where: { id: rideId },
            data: {
                status: client_1.RideStatus.CANCELLED,
                cancelledAt: new Date(),
            },
            include: {
                passenger: { select: { id: true, email: true } },
                driver: { select: { id: true, email: true } },
            },
        });
        this.ridesGateway.notifyRideRoom(rideId, 'ride_cancelled', {
            rideId,
            cancelledBy: role,
            status: client_1.RideStatus.CANCELLED,
        });
        if (updated.passenger?.email) {
            await this.mailService.sendRideCancelledEmail(updated.passenger.email, { rideId: updated.id });
        }
        if (updated.driver?.email) {
            await this.mailService.sendRideCancelledEmail(updated.driver.email, { rideId: updated.id });
        }
        return updated;
    }
    async rateRide(rideId, userId, role, rating, comment) {
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            throw new common_1.BadRequestException('La note doit être comprise entre 1 et 5');
        }
        const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
        if (!ride)
            throw new common_1.NotFoundException('Course introuvable');
        if (ride.status !== client_1.RideStatus.COMPLETED) {
            throw new common_1.BadRequestException('La notation est disponible après la fin de course');
        }
        if (role === 'PASSENGER') {
            if (ride.passengerId !== userId) {
                throw new common_1.ForbiddenException('Vous ne pouvez pas noter cette course');
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
                throw new common_1.ForbiddenException('Vous ne pouvez pas noter cette course');
            }
            return this.prisma.ride.update({
                where: { id: rideId },
                data: {
                    passengerRating: rating,
                    driverComment: comment,
                },
            });
        }
        throw new common_1.ForbiddenException('Rôle non autorisé');
    }
    async createScheduledRide(passengerId, data) {
        const scheduledAt = new Date(data.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
            throw new common_1.BadRequestException('La date doit être dans le futur');
        }
        const ride = await this.create({
            originLat: Number(data.originLat),
            originLng: Number(data.originLng),
            destLat: Number(data.destLat),
            destLng: Number(data.destLng),
            price: Number(data.price),
            vehicleType: data.vehicleType ?? client_1.VehicleType.MOTO,
            paymentMethod: data.paymentMethod ?? client_1.PaymentMethod.CASH,
            originAddress: data.originAddress,
            destAddress: data.destAddress,
        }, passengerId);
        return { ...ride, isScheduled: true, scheduledAt };
    }
    async generateShareToken(rideId, passengerId) {
        const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
        if (!ride || ride.passengerId !== passengerId) {
            throw new common_1.ForbiddenException('Course introuvable ou non autorisée');
        }
        const nonce = (0, crypto_1.randomBytes)(6).toString('hex');
        const payload = `${rideId}.${Date.now()}.${nonce}`;
        const secret = process.env.RIDE_SHARE_SECRET || process.env.JWT_SECRET || 'koogwe-share-secret';
        const signature = (0, crypto_1.createHmac)('sha256', secret).update(payload).digest('hex').slice(0, 16);
        const token = Buffer.from(`${payload}.${signature}`).toString('base64url');
        const shareUrl = `${process.env.FRONTEND_URL || 'https://koogwe.com'}/track/${token}`;
        return { shareToken: token, shareUrl };
    }
    async getRideByShareToken(token) {
        let decoded = '';
        try {
            decoded = Buffer.from(token, 'base64url').toString('utf8');
        }
        catch {
            throw new common_1.BadRequestException('Lien de partage invalide');
        }
        const [rideId, timestamp, nonce, signature] = decoded.split('.');
        if (!rideId || !timestamp || !nonce || !signature) {
            throw new common_1.BadRequestException('Lien de partage invalide');
        }
        const payload = `${rideId}.${timestamp}.${nonce}`;
        const secret = process.env.RIDE_SHARE_SECRET || process.env.JWT_SECRET || 'koogwe-share-secret';
        const expectedSignature = (0, crypto_1.createHmac)('sha256', secret).update(payload).digest('hex').slice(0, 16);
        if (signature !== expectedSignature) {
            throw new common_1.BadRequestException('Lien de partage invalide');
        }
        const ride = await this.prisma.ride.findUnique({
            where: { id: rideId },
            include: {
                passenger: { select: { name: true } },
                driver: { select: { name: true } },
            },
        });
        if (!ride)
            throw new common_1.NotFoundException('Course introuvable');
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
    async triggerPanic(userId, rideId, lat, lng) {
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
    async addFavoriteDriver(passengerId, driverId) {
        const driver = await this.prisma.user.findUnique({ where: { id: driverId } });
        if (!driver || driver.role !== 'DRIVER') {
            throw new common_1.NotFoundException('Chauffeur introuvable');
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
    async removeFavoriteDriver(passengerId, driverId) {
        await this.prisma.notification.deleteMany({
            where: {
                userId: passengerId,
                type: 'FAVORITE_DRIVER',
                title: driverId,
            },
        });
        return { success: true };
    }
    async getFavoriteDrivers(passengerId) {
        const favorites = await this.prisma.notification.findMany({
            where: {
                userId: passengerId,
                type: 'FAVORITE_DRIVER',
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!favorites.length)
            return [];
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
};
exports.RidesService = RidesService;
exports.RidesService = RidesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rides_gateway_1.RidesGateway,
        mail_service_1.MailService])
], RidesService);
//# sourceMappingURL=rides.service.js.map