import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RidesGateway } from './rides.gateway';
import { CreateRideDto } from './dto/create-ride.dto';
import { RideStatus, VehicleType } from '@prisma/client';

@Injectable()
export class RidesService {
  constructor(
    private prisma: PrismaService,
    private ridesGateway: RidesGateway,
  ) {}

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
        status: RideStatus.REQUESTED,
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

  async getHistory(userId: string, role: string) {
    const where =
      role === 'DRIVER'
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
      passenger: ride.passenger
        ? { id: ride.passenger.id, name: ride.passenger.name, email: ride.passenger.email }
        : null,
      driver: ride.driver
        ? { id: ride.driver.id, name: ride.driver.name, email: ride.driver.email }
        : null,
      name:
        role === 'DRIVER'
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
            RideStatus.REQUESTED,
            RideStatus.ACCEPTED,
            RideStatus.ARRIVED,
            RideStatus.IN_PROGRESS,
          ],
        },
      },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async getDriverStats(driverId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRides = await this.prisma.ride.findMany({
      where: {
        driverId,
        status: RideStatus.COMPLETED,
        requestedAt: { gte: today },
      },
    });

    const allRides = await this.prisma.ride.findMany({
      where: { driverId, status: RideStatus.COMPLETED },
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
}