import { PrismaService } from '../prisma.service';
export declare class DocumentsService {
    private prisma;
    private readonly uploadsRoot;
    private readonly requiredDriverDocs;
    constructor(prisma: PrismaService);
    private hasRequiredVehicleInfo;
    private hasAllRequiredApprovedDocuments;
    private parseDocumentType;
    uploadBase64Document(params: {
        userId: string;
        type: string;
        imageBase64: string;
    }): Promise<{
        success: boolean;
        message: string;
        documentId: string;
        fileUrl: string;
        type: import(".prisma/client").$Enums.DocumentType;
        status: import(".prisma/client").$Enums.DocumentStatus;
    }>;
    listPendingDocuments(): Promise<({
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
    listPendingDrivers(): Promise<{
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
    reviewDocument(params: {
        documentId: string;
        adminId: string;
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
    decideDriverAccount(params: {
        driverId: string;
        adminId: string;
        approved: boolean;
        adminNotes?: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    private refreshDriverApprovalState;
}
