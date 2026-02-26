import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(req: any): Promise<any>;
    updateVehicle(req: any, body: any): Promise<any>;
    verifyFace(req: any): Promise<any>;
    uploadDocuments(req: any, body: any): Promise<any>;
    driverStatus(req: any): Promise<{
        faceVerified: any;
        documentsUploaded: any;
        adminApproved: any;
        currentStep: string;
    }>;
}
