import { PrismaService } from '../prisma.service';
import { AWSRekognitionService } from './aws-rekognition.service';
export declare class FaceVerificationService {
    private prisma;
    private awsRekognition;
    constructor(prisma: PrismaService, awsRekognition: AWSRekognitionService);
    verifyLiveFace(userId: string, imageBase64: string): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyHeadMovements(userId: string, leftImage: string, rightImage: string, upImage: string, downImage: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
