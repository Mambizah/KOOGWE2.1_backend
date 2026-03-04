import { PaymentMethod, RideStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RidesGateway } from './rides.gateway';
import { CreateRideDto } from './dto/create-ride.dto';
import { MailService } from '../mail.service';
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
export declare class RidesService {
    private prisma;
    private ridesGateway;
    private mailService;
    constructor(prisma: PrismaService, ridesGateway: RidesGateway, mailService: MailService);
    estimatePrice(input: EstimateInput): {
        distanceKm: number;
        durationMin: number;
        vehicleType: string;
        breakdown: {
            pickupFee: number;
            kmRate: number;
            minuteRate: number;
            base: number;
            coefficients: {
                zone: number;
                horaire: number;
                trafic: number;
                meteo: number;
                demande: number;
            };
            surgeRaw: number;
            surgeApplied: number;
        };
        estimatedPrice: number;
        currency: string;
    };
    create(createRideDto: CreateRideDto, passengerId: string): Promise<{
        passenger: {
            email: string;
            name: string;
            phone: string;
            id: string;
        };
    } & {
        id: string;
        passengerId: string;
        driverId: string | null;
        originLat: number;
        originLng: number;
        originAddress: string | null;
        destLat: number;
        destLng: number;
        destAddress: string | null;
        distance: number | null;
        duration: number | null;
        price: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        airConditioning: boolean;
        wifi: boolean;
        usb: boolean;
        music: boolean;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        isPaid: boolean;
        status: import(".prisma/client").$Enums.RideStatus;
        requestedAt: Date;
        acceptedAt: Date | null;
        arrivedAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        passengerRating: number | null;
        driverRating: number | null;
        passengerComment: string | null;
        driverComment: string | null;
    }>;
    getHistory(userId: string, role: string): Promise<{
        id: string;
        price: number;
        status: import(".prisma/client").$Enums.RideStatus;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        requestedAt: Date;
        originLat: number;
        originLng: number;
        destLat: number;
        destLng: number;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        isPaid: boolean;
        passengerRating: number;
        driverRating: number;
        passenger: {
            id: string;
            name: string;
        };
        driver: {
            id: string;
            name: string;
        };
        name: string;
        date: string;
    }[]>;
    getDriverStats(driverId: string): Promise<{
        dailyEarnings: number;
        weeklyEarnings: number;
        monthlyEarnings: number;
        yearlyEarnings: number;
        totalEarnings: number;
        todayRides: number;
        weekRides: number;
        monthRides: number;
        totalRides: number;
        totalHours: number;
        monthHours: number;
        cashRides: number;
        walletRides: number;
        cashEarnings: number;
        walletEarnings: number;
        last30Days: {
            date: string;
            revenue: number;
            rides: number;
        }[];
        hotZones: {
            lat: number;
            lng: number;
            count: number;
        }[];
    }>;
    getActiveCourses(): Promise<({
        passenger: {
            name: string;
            phone: string;
            id: string;
        };
        driver: {
            name: string;
            phone: string;
            id: string;
        };
    } & {
        id: string;
        passengerId: string;
        driverId: string | null;
        originLat: number;
        originLng: number;
        originAddress: string | null;
        destLat: number;
        destLng: number;
        destAddress: string | null;
        distance: number | null;
        duration: number | null;
        price: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        airConditioning: boolean;
        wifi: boolean;
        usb: boolean;
        music: boolean;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        isPaid: boolean;
        status: import(".prisma/client").$Enums.RideStatus;
        requestedAt: Date;
        acceptedAt: Date | null;
        arrivedAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        passengerRating: number | null;
        driverRating: number | null;
        passengerComment: string | null;
        driverComment: string | null;
    })[]>;
    acceptRide(rideId: string, driverId: string): Promise<{
        passenger: {
            email: string;
            name: string;
            phone: string;
            id: string;
        };
        driver: {
            email: string;
            name: string;
            phone: string;
            id: string;
        };
    } & {
        id: string;
        passengerId: string;
        driverId: string | null;
        originLat: number;
        originLng: number;
        originAddress: string | null;
        destLat: number;
        destLng: number;
        destAddress: string | null;
        distance: number | null;
        duration: number | null;
        price: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        airConditioning: boolean;
        wifi: boolean;
        usb: boolean;
        music: boolean;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        isPaid: boolean;
        status: import(".prisma/client").$Enums.RideStatus;
        requestedAt: Date;
        acceptedAt: Date | null;
        arrivedAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        passengerRating: number | null;
        driverRating: number | null;
        passengerComment: string | null;
        driverComment: string | null;
    }>;
    updateStatus(rideId: string, driverId: string, status: RideStatus): Promise<{
        passenger: {
            email: string;
            id: string;
        };
        driver: {
            email: string;
            name: string;
            id: string;
        };
    } & {
        id: string;
        passengerId: string;
        driverId: string | null;
        originLat: number;
        originLng: number;
        originAddress: string | null;
        destLat: number;
        destLng: number;
        destAddress: string | null;
        distance: number | null;
        duration: number | null;
        price: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        airConditioning: boolean;
        wifi: boolean;
        usb: boolean;
        music: boolean;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        isPaid: boolean;
        status: import(".prisma/client").$Enums.RideStatus;
        requestedAt: Date;
        acceptedAt: Date | null;
        arrivedAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        passengerRating: number | null;
        driverRating: number | null;
        passengerComment: string | null;
        driverComment: string | null;
    }>;
    cancelRide(rideId: string, userId: string, role: string): Promise<{
        passenger: {
            email: string;
            id: string;
        };
        driver: {
            email: string;
            id: string;
        };
    } & {
        id: string;
        passengerId: string;
        driverId: string | null;
        originLat: number;
        originLng: number;
        originAddress: string | null;
        destLat: number;
        destLng: number;
        destAddress: string | null;
        distance: number | null;
        duration: number | null;
        price: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        airConditioning: boolean;
        wifi: boolean;
        usb: boolean;
        music: boolean;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        isPaid: boolean;
        status: import(".prisma/client").$Enums.RideStatus;
        requestedAt: Date;
        acceptedAt: Date | null;
        arrivedAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        passengerRating: number | null;
        driverRating: number | null;
        passengerComment: string | null;
        driverComment: string | null;
    }>;
    rateRide(rideId: string, userId: string, role: string, rating: number, comment?: string): Promise<{
        id: string;
        passengerId: string;
        driverId: string | null;
        originLat: number;
        originLng: number;
        originAddress: string | null;
        destLat: number;
        destLng: number;
        destAddress: string | null;
        distance: number | null;
        duration: number | null;
        price: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        airConditioning: boolean;
        wifi: boolean;
        usb: boolean;
        music: boolean;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        isPaid: boolean;
        status: import(".prisma/client").$Enums.RideStatus;
        requestedAt: Date;
        acceptedAt: Date | null;
        arrivedAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        passengerRating: number | null;
        driverRating: number | null;
        passengerComment: string | null;
        driverComment: string | null;
    }>;
    createScheduledRide(passengerId: string, data: {
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
    }): Promise<{
        isScheduled: boolean;
        scheduledAt: Date;
        passenger: {
            email: string;
            name: string;
            phone: string;
            id: string;
        };
        id: string;
        passengerId: string;
        driverId: string | null;
        originLat: number;
        originLng: number;
        originAddress: string | null;
        destLat: number;
        destLng: number;
        destAddress: string | null;
        distance: number | null;
        duration: number | null;
        price: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        airConditioning: boolean;
        wifi: boolean;
        usb: boolean;
        music: boolean;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        isPaid: boolean;
        status: import(".prisma/client").$Enums.RideStatus;
        requestedAt: Date;
        acceptedAt: Date | null;
        arrivedAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        passengerRating: number | null;
        driverRating: number | null;
        passengerComment: string | null;
        driverComment: string | null;
    }>;
    generateShareToken(rideId: string, passengerId: string): Promise<{
        shareToken: string;
        shareUrl: string;
    }>;
    getRideByShareToken(token: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.RideStatus;
        originLat: number;
        originLng: number;
        destLat: number;
        destLng: number;
        originAddress: string;
        destAddress: string;
        passengerName: string;
        driverName: string;
        price: number;
    }>;
    triggerPanic(userId: string, rideId: string | null, lat: number, lng: number): Promise<{
        success: boolean;
        message: string;
    }>;
    addFavoriteDriver(passengerId: string, driverId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    removeFavoriteDriver(passengerId: string, driverId: string): Promise<{
        success: boolean;
    }>;
    getFavoriteDrivers(passengerId: string): Promise<{
        driverId: string;
        name: string;
        phone: string;
        vehicle: {
            vehicleMake: string;
            vehicleModel: string;
            vehicleColor: string;
        };
    }[]>;
}
export {};
