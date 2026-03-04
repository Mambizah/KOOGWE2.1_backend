import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    getPendingDrivers(): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        accountStatus: import(".prisma/client").$Enums.AccountStatus;
        faceVerified: boolean;
        driverProfile: {
            id: string;
            faceVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            vehicleMake: string | null;
            vehicleModel: string | null;
            vehicleColor: string | null;
            licensePlate: string | null;
            vehicleYear: number | null;
            faceVerifiedAt: Date | null;
            documentsUploaded: boolean;
            documentsUploadedAt: Date | null;
            adminApproved: boolean;
            adminApprovedAt: Date | null;
            adminNotes: string | null;
            totalRides: number;
            rating: number;
            totalEarnings: number;
            isOnline: boolean;
            currentLat: number | null;
            currentLng: number | null;
        };
        documents: {
            id: string;
            userId: string;
            type: import(".prisma/client").$Enums.DocumentType;
            status: import(".prisma/client").$Enums.DocumentStatus;
            rejectionReason: string | null;
            fileUrl: string;
            uploadedAt: Date;
            reviewedAt: Date | null;
            reviewedBy: string | null;
        }[];
        documentsSummary: {
            pending: number;
            approved: number;
            rejected: number;
        };
        canBeApproved: boolean;
    }[]>;
    getPendingDocuments(): Promise<({
        user: {
            email: string;
            name: string;
            phone: string;
            role: import(".prisma/client").$Enums.Role;
            id: string;
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
    reviewDocument(params: {
        documentId: string;
        adminId: string;
        status: DocumentStatus;
        rejectionReason?: string;
    }): Promise<{
        user: {
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
            id: string;
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
    }>;
    setDriverApproval(params: {
        driverId: string;
        approved: boolean;
        adminNotes?: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    private refreshDriverReviewStatus;
    private hasAllRequiredApprovedDocuments;
}
