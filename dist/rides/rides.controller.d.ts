import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
export declare class RidesController {
    private readonly ridesService;
    constructor(ridesService: RidesService);
    create(req: any, createRideDto: CreateRideDto): Promise<any>;
    getHistory(req: any): Promise<any>;
    getDriverStats(req: any): Promise<{
        dailyEarnings: number;
        totalEarnings: number;
        todayRides: any;
        totalRides: any;
    }>;
    getActiveCourses(): Promise<any>;
}
