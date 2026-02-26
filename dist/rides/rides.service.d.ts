import { PrismaService } from '../prisma.service';
import { RidesGateway } from './rides.gateway';
import { CreateRideDto } from './dto/create-ride.dto';
export declare class RidesService {
    private prisma;
    private ridesGateway;
    constructor(prisma: PrismaService, ridesGateway: RidesGateway);
    create(createRideDto: CreateRideDto, passengerId: string): Promise<any>;
    getHistory(userId: string, role: string): Promise<any>;
    getActiveCourses(): Promise<any>;
    getDriverStats(driverId: string): Promise<{
        dailyEarnings: number;
        totalEarnings: number;
        todayRides: any;
        totalRides: any;
    }>;
}
