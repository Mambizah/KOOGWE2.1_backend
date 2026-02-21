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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RidesGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma.service");
const client_1 = require("@prisma/client");
let RidesGateway = class RidesGateway {
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
        this.socketUserMap = new Map();
    }
    afterInit() {
        console.log('✅ Socket Gateway initialisé');
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.headers.authorization?.replace('Bearer ', '') ??
                client.handshake.auth?.token;
            if (token) {
                const payload = await this.jwtService.verifyAsync(token, {
                    secret: this.configService.get('JWT_SECRET'),
                });
                this.socketUserMap.set(client.id, payload.sub);
                console.log(`🔌 Client connecté: ${client.id} (user: ${payload.sub})`);
            }
            else {
                console.log(`🔌 Client connecté sans auth: ${client.id}`);
            }
        }
        catch {
            console.log(`⚠️ Token invalide pour: ${client.id}`);
        }
    }
    handleDisconnect(client) {
        this.socketUserMap.delete(client.id);
        console.log(`🔌 Client déconnecté: ${client.id}`);
    }
    handleJoinRide(client, data) {
        const room = `ride_${data.rideId}`;
        client.join(room);
        console.log(`👥 ${client.id} rejoint ${room}`);
    }
    handleLeaveRide(client, data) {
        client.leave(`ride_${data.rideId}`);
    }
    handleDriverOnline(client, data) {
        const authenticatedUserId = this.socketUserMap.get(client.id);
        if (authenticatedUserId && authenticatedUserId !== data.driverId) {
            console.warn(`⚠️ Tentative d'usurpation: ${client.id}`);
            return;
        }
        client.join('drivers_online');
        console.log(`🟢 Chauffeur ${data.driverId} en ligne`);
    }
    handleDriverOffline(client, data) {
        client.leave('drivers_online');
        console.log(`🔴 Chauffeur ${data.driverId} hors ligne`);
    }
    notifyDrivers(rideData) {
        this.server.to('drivers_online').emit('new_ride', rideData);
        console.log(`📢 Nouvelle course ${rideData.id} envoyée aux chauffeurs`);
    }
    async handleAcceptRide(client, data) {
        try {
            const authenticatedUserId = this.socketUserMap.get(client.id);
            if (authenticatedUserId && authenticatedUserId !== data.driverId) {
                console.warn(`⚠️ Tentative frauduleuse accept_ride: ${client.id}`);
                return;
            }
            const driver = await this.prisma.user.findUnique({
                where: { id: data.driverId },
                include: { driverProfile: true },
            });
            if (!driver)
                return;
            const ride = await this.prisma.ride.findUnique({ where: { id: data.rideId } });
            if (!ride || ride.status !== client_1.RideStatus.REQUESTED) {
                console.warn(`⚠️ Course ${data.rideId} non disponible`);
                return;
            }
            await this.prisma.ride.update({
                where: { id: data.rideId },
                data: { status: client_1.RideStatus.ACCEPTED, driverId: data.driverId, acceptedAt: new Date() },
            });
            const vehicleInfo = driver.driverProfile
                ? `${driver.driverProfile.vehicleMake ?? ''} ${driver.driverProfile.vehicleModel ?? ''} • ${driver.driverProfile.vehicleColor ?? ''}`
                : 'Véhicule non renseigné';
            this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
                status: 'ACCEPTED',
                driverId: driver.id,
                driverName: driver.name,
                driverPhone: driver.phone,
                vehicleInfo,
                licensePlate: driver.driverProfile?.licensePlate ?? 'Non renseigné',
                driverRating: '4.9 ⭐',
            });
            console.log(`✅ Course ${data.rideId} acceptée par ${driver.name}`);
        }
        catch (e) {
            console.error('Erreur accept_ride:', e);
        }
    }
    async handleDriverArrived(client, data) {
        try {
            const authenticatedUserId = this.socketUserMap.get(client.id);
            if (authenticatedUserId) {
                const ride = await this.prisma.ride.findUnique({ where: { id: data.rideId } });
                if (ride && ride.driverId && ride.driverId !== authenticatedUserId) {
                    console.warn(`⚠️ Tentative frauduleuse driver_arrived`);
                    return;
                }
            }
            await this.prisma.ride.update({
                where: { id: data.rideId },
                data: { status: client_1.RideStatus.ARRIVED, arrivedAt: new Date() },
            });
            this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, { status: 'ARRIVED' });
        }
        catch (e) {
            console.error('Erreur driver_arrived:', e);
        }
    }
    async handleStartTrip(client, data) {
        try {
            const authenticatedUserId = this.socketUserMap.get(client.id);
            if (authenticatedUserId) {
                const ride = await this.prisma.ride.findUnique({ where: { id: data.rideId } });
                if (ride && ride.driverId && ride.driverId !== authenticatedUserId) {
                    console.warn(`⚠️ Tentative frauduleuse start_trip`);
                    return;
                }
            }
            await this.prisma.ride.update({
                where: { id: data.rideId },
                data: { status: client_1.RideStatus.IN_PROGRESS, startedAt: new Date() },
            });
            this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, { status: 'IN_PROGRESS' });
        }
        catch (e) {
            console.error('Erreur start_trip:', e);
        }
    }
    async handleFinishTrip(client, data) {
        try {
            const authenticatedUserId = this.socketUserMap.get(client.id);
            if (authenticatedUserId) {
                const ride = await this.prisma.ride.findUnique({ where: { id: data.rideId } });
                if (ride && ride.driverId && ride.driverId !== authenticatedUserId) {
                    console.warn(`⚠️ Tentative frauduleuse finish_trip par ${client.id}`);
                    return;
                }
                data.price = undefined;
            }
            const updatedRide = await this.prisma.ride.update({
                where: { id: data.rideId },
                data: {
                    status: client_1.RideStatus.COMPLETED,
                    completedAt: new Date(),
                },
                include: {
                    passenger: { select: { id: true, name: true } },
                    driver: { select: { id: true, name: true } },
                },
            });
            this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, {
                status: 'COMPLETED',
                finalPrice: updatedRide.price,
            });
            this.server.emit('trip_finished', {
                id: updatedRide.id,
                price: updatedRide.price,
                status: 'COMPLETED',
                vehicleType: updatedRide.vehicleType,
                requestedAt: updatedRide.requestedAt,
                passenger: updatedRide.passenger,
                driver: updatedRide.driver,
            });
            if (updatedRide.driverId) {
                await this.prisma.driverProfile.update({
                    where: { userId: updatedRide.driverId },
                    data: {
                        totalRides: { increment: 1 },
                        totalEarnings: { increment: updatedRide.price },
                    },
                });
            }
            console.log(`✅ Course ${data.rideId} terminée`);
        }
        catch (e) {
            console.error('Erreur finish_trip:', e);
        }
    }
    handleLocationUpdate(data) {
        this.server.to(`ride_${data.rideId}`).emit(`driver_location_${data.rideId}`, {
            lat: data.lat,
            lng: data.lng,
        });
    }
    handleChatMessage(data) {
        this.server.to(`ride_${data.rideId}`).emit(`chat_${data.rideId}`, {
            senderId: data.senderId,
            message: data.message,
            timestamp: data.timestamp,
        });
    }
};
exports.RidesGateway = RidesGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RidesGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_ride'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], RidesGateway.prototype, "handleJoinRide", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_ride'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], RidesGateway.prototype, "handleLeaveRide", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('driver_online'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], RidesGateway.prototype, "handleDriverOnline", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('driver_offline'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], RidesGateway.prototype, "handleDriverOffline", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('accept_ride'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RidesGateway.prototype, "handleAcceptRide", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('driver_arrived'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RidesGateway.prototype, "handleDriverArrived", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('start_trip'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RidesGateway.prototype, "handleStartTrip", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('finish_trip'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RidesGateway.prototype, "handleFinishTrip", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('update_location'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RidesGateway.prototype, "handleLocationUpdate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('chat_message'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RidesGateway.prototype, "handleChatMessage", null);
exports.RidesGateway = RidesGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], RidesGateway);
//# sourceMappingURL=rides.gateway.js.map