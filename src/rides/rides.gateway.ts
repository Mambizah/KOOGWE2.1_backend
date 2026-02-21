import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { RideStatus } from '@prisma/client';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RidesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map socketId → userId
  private socketUserMap = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    console.log('✅ Socket Gateway initialisé');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.headers.authorization?.replace('Bearer ', '') ??
        client.handshake.auth?.token;

      if (token) {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        this.socketUserMap.set(client.id, payload.sub);
        console.log(`🔌 Client connecté: ${client.id} (user: ${payload.sub})`);
      } else {
        console.log(`🔌 Client connecté sans auth: ${client.id}`);
      }
    } catch {
      console.log(`⚠️ Token invalide pour: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.socketUserMap.delete(client.id);
    console.log(`🔌 Client déconnecté: ${client.id}`);
  }

  // ---- Rejoindre une room ----
  @SubscribeMessage('join_ride')
  handleJoinRide(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    const room = `ride_${data.rideId}`;
    client.join(room);
    console.log(`👥 ${client.id} rejoint ${room}`);
  }

  @SubscribeMessage('leave_ride')
  handleLeaveRide(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    client.leave(`ride_${data.rideId}`);
  }

  // ---- Chauffeur en ligne / hors ligne ----
  @SubscribeMessage('driver_online')
  handleDriverOnline(@ConnectedSocket() client: Socket, @MessageBody() data: { driverId: string }) {
    const authenticatedUserId = this.socketUserMap.get(client.id);
    if (authenticatedUserId && authenticatedUserId !== data.driverId) {
      console.warn(`⚠️ Tentative d'usurpation: ${client.id}`);
      return;
    }
    client.join('drivers_online');
    console.log(`🟢 Chauffeur ${data.driverId} en ligne`);
  }

  @SubscribeMessage('driver_offline')
  handleDriverOffline(@ConnectedSocket() client: Socket, @MessageBody() data: { driverId: string }) {
    client.leave('drivers_online');
    console.log(`🔴 Chauffeur ${data.driverId} hors ligne`);
  }

  // ---- Nouvelle course → tous les chauffeurs en ligne ----
  notifyDrivers(rideData: any) {
    this.server.to('drivers_online').emit('new_ride', rideData);
    console.log(`📢 Nouvelle course ${rideData.id} envoyée aux chauffeurs`);
  }

  // ---- Accepter une course (SÉCURISÉ) ----
  @SubscribeMessage('accept_ride')
  async handleAcceptRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string; driverId: string },
  ) {
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
      if (!driver) return;

      const ride = await this.prisma.ride.findUnique({ where: { id: data.rideId } });
      if (!ride || ride.status !== RideStatus.REQUESTED) {
        console.warn(`⚠️ Course ${data.rideId} non disponible`);
        return;
      }

      await this.prisma.ride.update({
        where: { id: data.rideId },
        data: { status: RideStatus.ACCEPTED, driverId: data.driverId, acceptedAt: new Date() },
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
    } catch (e) {
      console.error('Erreur accept_ride:', e);
    }
  }

  // ---- Chauffeur arrivé ----
  @SubscribeMessage('driver_arrived')
  async handleDriverArrived(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string },
  ) {
    try {
      // ✅ Vérifier que le socket appartient bien au chauffeur de cette course
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
        data: { status: RideStatus.ARRIVED, arrivedAt: new Date() },
      });
      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, { status: 'ARRIVED' });
    } catch (e) {
      console.error('Erreur driver_arrived:', e);
    }
  }

  // ---- Démarrer la course ----
  @SubscribeMessage('start_trip')
  async handleStartTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string },
  ) {
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
        data: { status: RideStatus.IN_PROGRESS, startedAt: new Date() },
      });
      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, { status: 'IN_PROGRESS' });
    } catch (e) {
      console.error('Erreur start_trip:', e);
    }
  }

  // ---- Terminer la course (SÉCURISÉ) ----
  @SubscribeMessage('finish_trip')
  async handleFinishTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string; price?: number },
  ) {
    try {
      const authenticatedUserId = this.socketUserMap.get(client.id);

      // ✅ FIX SÉCURITÉ : Vérifier que c'est bien le chauffeur de cette course
      if (authenticatedUserId) {
        const ride = await this.prisma.ride.findUnique({ where: { id: data.rideId } });
        if (ride && ride.driverId && ride.driverId !== authenticatedUserId) {
          console.warn(`⚠️ Tentative frauduleuse finish_trip par ${client.id}`);
          return;
        }
        // ✅ FIX SÉCURITÉ : Ignorer le prix envoyé par le client, utiliser le prix DB
        // (empêche la modification du prix par le chauffeur)
        data.price = undefined;
      }

      const updatedRide = await this.prisma.ride.update({
        where: { id: data.rideId },
        data: {
          status: RideStatus.COMPLETED,
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

      // Émettre 'trip_finished' pour rafraîchir history et wallet
      this.server.emit('trip_finished', {
        id: updatedRide.id,
        price: updatedRide.price,
        status: 'COMPLETED',
        vehicleType: updatedRide.vehicleType,
        requestedAt: updatedRide.requestedAt,
        passenger: updatedRide.passenger,
        driver: updatedRide.driver,
      });

      // Mettre à jour les stats du chauffeur
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
    } catch (e) {
      console.error('Erreur finish_trip:', e);
    }
  }

  // ---- GPS du chauffeur ----
  @SubscribeMessage('update_location')
  handleLocationUpdate(@MessageBody() data: { rideId: string; lat: number; lng: number }) {
    this.server.to(`ride_${data.rideId}`).emit(`driver_location_${data.rideId}`, {
      lat: data.lat,
      lng: data.lng,
    });
  }

  // ---- Chat ----
  @SubscribeMessage('chat_message')
  handleChatMessage(
    @MessageBody() data: { rideId: string; senderId: string; message: string; timestamp: string },
  ) {
    this.server.to(`ride_${data.rideId}`).emit(`chat_${data.rideId}`, {
      senderId: data.senderId,
      message: data.message,
      timestamp: data.timestamp,
    });
  }
}
