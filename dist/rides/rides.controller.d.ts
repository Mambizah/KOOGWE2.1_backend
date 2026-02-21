import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
export declare class RidesController {
    private readonly ridesService;
    constructor(ridesService: RidesService);
    create(req: any, createRideDto: CreateRideDto): Promise<{
        passenger: {
            name: string;
            email: string;
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
        passenger: {
            id: string;
            name: string;
            email: string;
        };
        driver: {
            id: string;
            name: string;
            email: string;
        };
        name: string;
        rating: string;
        dist: string;
        time: string;
        date: string;
    }[]>;
    getDriverStats(req: any): Promise<{
        dailyEarnings: number;
        totalEarnings: number;
        todayRides: number;
        totalRides: number;
    }>;
    getActiveCourses(): Promise<({
        passenger: {
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
}
