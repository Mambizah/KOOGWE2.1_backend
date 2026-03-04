import { RidesService } from './rides.service';
import { RideStatus } from '@prisma/client';
export declare class RidesController {
    private ridesService;
    constructor(ridesService: RidesService);
    create(dto: any, req: any): Promise<{
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
    getHistory(req: any): Promise<{
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
    getDriverStats(req: any): Promise<{
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
    estimatePrice(dto: {
        distanceKm: number;
        durationMin: number;
        vehicleType?: string;
        zone?: string;
        horaire?: string;
        trafic?: string;
        meteo?: string;
        demande?: string;
    }): {
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
    acceptRide(id: string, req: any): Promise<{
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
    updateStatus(id: string, dto: {
        status: RideStatus;
    }, req: any): Promise<{
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
    createScheduled(dto: any, req: any): Promise<{
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
    generateShare(id: string, req: any): Promise<{
        shareToken: string;
        shareUrl: string;
    }>;
    triggerPanic(dto: {
        rideId?: string;
        lat: number;
        lng: number;
    }, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    addFavorite(dto: {
        driverId: string;
    }, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    removeFavorite(dto: {
        driverId: string;
    }, req: any): Promise<{
        success: boolean;
    }>;
    getFavorites(req: any): Promise<{
        driverId: string;
        name: string;
        phone: string;
        vehicle: {
            vehicleMake: string;
            vehicleModel: string;
            vehicleColor: string;
        };
    }[]>;
    trackByToken(token: string): Promise<{
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
    cancelRide(id: string, req: any): Promise<{
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
    rateRide(id: string, dto: {
        rating: number;
        comment?: string;
    }, req: any): Promise<{
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
}
