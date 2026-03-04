import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private configService;
    constructor(configService: ConfigService);
    sendVerificationCode(email: string, code: string): Promise<void>;
    sendWelcomeEmail(email: string, name: string): Promise<void>;
    sendRideValidationEmail(email: string, payload: {
        rideId: string;
        status: string;
        price: number;
        vehicleType: string;
    }): Promise<void>;
    sendDriverAssignedEmail(email: string, payload: {
        rideId: string;
        driverName: string;
        driverPhone?: string;
    }): Promise<void>;
    sendRideCancelledEmail(email: string, payload: {
        rideId: string;
    }): Promise<void>;
    sendRideCompletedEmail(email: string, payload: {
        rideId: string;
        price: number;
    }): Promise<void>;
}
