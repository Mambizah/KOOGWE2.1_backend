import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
export declare class RidesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly prisma;
    private readonly jwtService;
    private readonly configService;
    server: Server;
    private socketUserMap;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    afterInit(): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleJoinRide(client: Socket, data: {
        rideId: string;
    }): void;
    handleLeaveRide(client: Socket, data: {
        rideId: string;
    }): void;
    handleDriverOnline(client: Socket, data: {
        driverId: string;
    }): Promise<void>;
    handleDriverOffline(client: Socket, data: {
        driverId: string;
    }): Promise<void>;
    notifyDrivers(rideData: any): void;
    notifyPassenger(passengerId: string, event: string, payload: any): void;
    notifyRideRoom(rideId: string, event: string, payload: any): void;
    handleAcceptRide(client: Socket, data: {
        rideId: string;
        driverId: string;
    }): Promise<void>;
    handleDriverArrived(client: Socket, data: {
        rideId: string;
    }): Promise<void>;
    handleStartTrip(client: Socket, data: {
        rideId: string;
    }): Promise<void>;
    handleFinishTrip(client: Socket, data: {
        rideId: string;
        price?: number;
    }): Promise<void>;
    handleLocationUpdate(data: {
        rideId: string;
        lat: number;
        lng: number;
    }): void;
    handleChatMessage(data: {
        rideId: string;
        senderId: string;
        message: string;
        timestamp: string;
    }): void;
}
