import { DocumentsService } from './documents.service';
export declare class DocumentsController {
    private readonly documentsService;
    constructor(documentsService: DocumentsService);
    private assertAdmin;
    upload(req: any, body: {
        type: string;
        imageBase64: string;
        userId?: string;
    }): Promise<{
        success: boolean;
        message: string;
        documentId: string;
        fileUrl: string;
        type: import(".prisma/client").$Enums.DocumentType;
        status: import(".prisma/client").$Enums.DocumentStatus;
    }>;
    getPendingDocuments(req: any): Promise<({
        user: {
            driverProfile: {
                faceVerified: boolean;
                documentsUploaded: boolean;
                adminApproved: boolean;
            };
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
            id: string;
            accountStatus: import(".prisma/client").$Enums.AccountStatus;
        };
    } & {
        id: string;
        userId: string;
        type: import(".prisma/client").$Enums.DocumentType;
        status: import(".prisma/client").$Enums.DocumentStatus;
        rejectionReason: string | null;
        fileUrl: string;
        uploadedAt: Date;
        reviewedAt: Date | null;
        reviewedBy: string | null;
    })[]>;
    getPendingDrivers(req: any): Promise<{
        driverProfile: {
            faceVerified: boolean;
            vehicleMake: string;
            vehicleModel: string;
            licensePlate: string;
            documentsUploaded: boolean;
            adminApproved: boolean;
            adminNotes: string;
        };
        email: string;
        name: string;
        id: string;
        accountStatus: import(".prisma/client").$Enums.AccountStatus;
    }[]>;
    reviewDocument(req: any, id: string, body: {
        status: 'APPROVED' | 'REJECTED';
        rejectionReason?: string;
    }): Promise<{
        success: boolean;
        message: string;
        document: {
            id: string;
            userId: string;
            type: import(".prisma/client").$Enums.DocumentType;
            status: import(".prisma/client").$Enums.DocumentStatus;
            rejectionReason: string | null;
            fileUrl: string;
            uploadedAt: Date;
            reviewedAt: Date | null;
            reviewedBy: string | null;
        };
    }>;
    decideDriver(req: any, driverId: string, body: {
        approved: boolean;
        adminNotes?: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
}
