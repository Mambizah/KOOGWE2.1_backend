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
        client.join(`user_${payload.sub}`);
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
  async handleDriverOnline(@ConnectedSocket() client: Socket, @MessageBody() data: { driverId: string }) {
    const authenticatedUserId = this.socketUserMap.get(client.id);
    if (authenticatedUserId && authenticatedUserId !== data.driverId) {
      console.warn(`⚠️ Tentative d'usurpation: ${client.id}`);
      return;
    }

    const driver = await this.prisma.user.findUnique({
      where: { id: data.driverId },
      include: { driverProfile: true },
    });

    const hasVehicleInfo = Boolean(
      driver?.driverProfile?.vehicleMake
      && driver?.driverProfile?.vehicleModel
      && driver?.driverProfile?.licensePlate,
    );

    const canGoOnline = Boolean(
      driver
      && driver.role === 'DRIVER'
      && driver.driverProfile
      && driver.driverProfile.faceVerified
      && driver.driverProfile.documentsUploaded
      && driver.driverProfile.adminApproved
      && hasVehicleInfo,
    );

    if (!canGoOnline) {
      this.server.to(client.id).emit('driver_restricted', {
        reason: 'Compte chauffeur incomplet: vérification, documents, véhicule et validation admin requis',
      });
      return;
    }

    await this.prisma.driverProfile.update({
      where: { userId: data.driverId },
      data: { isOnline: true },
    });

    client.join('drivers_online');
    console.log(`🟢 Chauffeur ${data.driverId} en ligne`);
  }

  @SubscribeMessage('driver_offline')
  async handleDriverOffline(@ConnectedSocket() client: Socket, @MessageBody() data: { driverId: string }) {
    client.leave('drivers_online');
    await this.prisma.driverProfile
      .update({ where: { userId: data.driverId }, data: { isOnline: false } })
      .catch(() => undefined);
    console.log(`🔴 Chauffeur ${data.driverId} hors ligne`);
  }

  // ---- Nouvelle course → tous les chauffeurs en ligne ----
  notifyDrivers(rideData: any) {
    this.server.to('drivers_online').emit('new_ride', rideData);
    console.log(`📢 Nouvelle course ${rideData.id} envoyée aux chauffeurs`);
  }

  notifyPassenger(passengerId: string, event: string, payload: any) {
    this.server.to(`user_${passengerId}`).emit(event, payload);
  }

  notifyRideRoom(rideId: string, event: string, payload: any) {
    this.server.to(`ride_${rideId}`).emit(event, payload);
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

      const hasVehicleInfo = Boolean(
        driver.driverProfile?.vehicleMake
        && driver.driverProfile?.vehicleModel
        && driver.driverProfile?.licensePlate,
      );
      const canAccept = Boolean(
        driver.role === 'DRIVER'
        && driver.driverProfile
        && driver.driverProfile.faceVerified
        && driver.driverProfile.documentsUploaded
        && driver.driverProfile.adminApproved
        && hasVehicleInfo,
      );
      if (!canAccept) {
        this.server.to(client.id).emit('driver_restricted', {
          reason: 'Compte chauffeur incomplet: vérification, documents, véhicule et validation admin requis',
        });
        return;
      }

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

      const acceptPayload = {
        status: 'ACCEPTED',
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        vehicleInfo,
        licensePlate: driver.driverProfile?.licensePlate ?? 'Non renseigné',
        driverRating: '4.9 ⭐',
      };

      // Émettre sur la room de la course (si le client a fait join_ride)
      this.server.to(`ride_\${data.rideId}`).emit(`ride_status_\${data.rideId}`, acceptPayload);

      // BUG FIX: Notifier aussi directement le passager via sa room personnelle
      // Garanti même si le client n'a pas encore appelé join_ride
      this.server.to(`user_${ride.passengerId}`).emit('ride_accepted', acceptPayload);

      console.log(`✅ Course ${data.rideId} acceptée par ${driver.name}`);
    } catch (e) {
      console.error('Erreur accept_ride:', e);
      // BUG FIX 5: Notifier le chauffeur de l'erreur (ex: type véhicule incompatible)
      const msg = (e as any)?.message || 'Erreur lors de l\'acceptation';
      client.emit('accept_ride_error', { message: msg });
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

      const completedPayload = {
        status: 'COMPLETED',
        finalPrice: updatedRide.price,
        rideId: data.rideId,
        driver: updatedRide.driver,
        passenger: updatedRide.passenger,
      };

      // Notifier la room de la course
      this.server.to(`ride_${data.rideId}`).emit(`ride_status_${data.rideId}`, completedPayload);

      // BUG FIX 1: Notifier DIRECTEMENT le passager même s'il n'est pas dans la room
      if (updatedRide.passengerId) {
        this.server.to(`user_${updatedRide.passengerId}`).emit('ride_completed', completedPayload);
        this.server.to(`user_${updatedRide.passengerId}`).emit(`ride_status_${data.rideId}`, completedPayload);
      }

      // BUG FIX 1: Notifier aussi le chauffeur (pour son écran actif)
      if (updatedRide.driverId) {
        this.server.to(`user_${updatedRide.driverId}`).emit('trip_finished_driver', {
          rideId: data.rideId,
          finalPrice: updatedRide.price,
          passengerName: updatedRide.passenger?.name,
        });
      }

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

      // BUG FIX 6: Paiement automatique wallet si paymentMethod === WALLET
      if (updatedRide.paymentMethod === 'WALLET' && !updatedRide.isPaid) {
        try {
          // Débiter le wallet du passager et créditer le chauffeur
          const wallet = await this.prisma.wallet.findUnique({ where: { userId: updatedRide.passengerId } });
          if (wallet && wallet.balance >= updatedRide.price) {
            await this.prisma.$transaction([
              this.prisma.wallet.update({
                where: { userId: updatedRide.passengerId },
                data: { balance: { decrement: updatedRide.price } },
              }),
              this.prisma.wallet.upsert({
                where: { userId: updatedRide.driverId! },
                create: { userId: updatedRide.driverId!, balance: updatedRide.price * 0.8 },
                update: { balance: { increment: updatedRide.price * 0.8 } },
              }),
              this.prisma.ride.update({
                where: { id: data.rideId },
                data: { isPaid: true },
              }),
              this.prisma.transaction.create({
                data: {
                  userId: updatedRide.passengerId,
                  type: 'PAYMENT',
                  amount: updatedRide.price,
                  status: 'COMPLETED',
                  rideId: data.rideId,
                },
              }),
            ]);
            // Confirmer le paiement au passager
            if (updatedRide.passengerId) {
              this.server.to(`user_${updatedRide.passengerId}`).emit('payment_confirmed', {
                rideId: data.rideId,
                amount: updatedRide.price,
                method: 'WALLET',
                isPaid: true,
              });
            }
            console.log(`💳 Paiement wallet auto: ${updatedRide.price}€ pour course ${data.rideId}`);
          } else {
            // Solde insuffisant - notifier le passager
            if (updatedRide.passengerId) {
              this.server.to(`user_${updatedRide.passengerId}`).emit('payment_failed', {
                rideId: data.rideId,
                reason: 'Solde insuffisant',
              });
            }
          }
        } catch (payErr) {
          console.error('Erreur paiement wallet auto:', payErr);
        }
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
