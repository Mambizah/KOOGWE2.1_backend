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
const prisma_service_1 = require("../prisma.service");
const rides_gateway_1 = require("./rides.gateway");
const client_1 = require("@prisma/client");
let RidesService = class RidesService {
    constructor(prisma, ridesGateway) {
        this.prisma = prisma;
        this.ridesGateway = ridesGateway;
    }
    async create(createRideDto, passengerId) {
        const newRide = await this.prisma.ride.create({
            data: {
                passengerId,
                originLat: Number(createRideDto.originLat),
                originLng: Number(createRideDto.originLng),
                destLat: Number(createRideDto.destLat),
                destLng: Number(createRideDto.destLng),
                price: Number(createRideDto.price),
                vehicleType: createRideDto.vehicleType ?? client_1.VehicleType.MOTO,
                status: client_1.RideStatus.REQUESTED,
            },
            include: {
                passenger: {
                    select: { id: true, name: true, phone: true, email: true },
                },
            },
        });
        this.ridesGateway.notifyDrivers(newRide);
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
            passenger: ride.passenger
                ? { id: ride.passenger.id, name: ride.passenger.name, email: ride.passenger.email }
                : null,
            driver: ride.driver
                ? { id: ride.driver.id, name: ride.driver.name, email: ride.driver.email }
                : null,
            name: role === 'DRIVER'
                ? (ride.passenger?.name ?? 'Passager')
                : (ride.driver?.name ?? 'Chauffeur'),
            rating: '5.0',
            dist: '—',
            time: '—',
            date: ride.requestedAt.toLocaleDateString('fr-FR'),
        }));
    }
    async getActiveCourses() {
        return this.prisma.ride.findMany({
            where: {
                status: {
                    in: [
                        client_1.RideStatus.REQUESTED,
                        client_1.RideStatus.ACCEPTED,
                        client_1.RideStatus.ARRIVED,
                        client_1.RideStatus.IN_PROGRESS,
                    ],
                },
            },
            include: {
                passenger: { select: { id: true, name: true, phone: true } },
            },
            orderBy: { requestedAt: 'desc' },
        });
    }
    async getDriverStats(driverId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayRides = await this.prisma.ride.findMany({
            where: {
                driverId,
                status: client_1.RideStatus.COMPLETED,
                requestedAt: { gte: today },
            },
        });
        const allRides = await this.prisma.ride.findMany({
            where: { driverId, status: client_1.RideStatus.COMPLETED },
        });
        const dailyEarnings = todayRides.reduce((sum, r) => sum + r.price, 0);
        const totalEarnings = allRides.reduce((sum, r) => sum + r.price, 0);
        return {
            dailyEarnings: Math.round(dailyEarnings),
            totalEarnings: Math.round(totalEarnings),
            todayRides: todayRides.length,
            totalRides: allRides.length,
        };
    }
};
exports.RidesService = RidesService;
exports.RidesService = RidesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rides_gateway_1.RidesGateway])
], RidesService);
//# sourceMappingURL=rides.service.js.map