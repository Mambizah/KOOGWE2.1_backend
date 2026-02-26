import { PrismaService } from '../prisma.service';
export interface UpdateVehicleDto {
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    licensePlate?: string;
}
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    updateVehicle(userId: string, data: UpdateVehicleDto): Promise<any>;
    markFaceVerified(userId: string): Promise<any>;
    markDocumentsUploaded(userId: string): Promise<any>;
    getDriverStatus(userId: string): Promise<{
        faceVerified: any;
        documentsUploaded: any;
        adminApproved: any;
        currentStep: string;
    }>;
    getProfile(userId: string): Promise<any>;
}
