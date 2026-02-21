import { FaceVerificationService } from './face-verification.service';
export declare class FaceVerificationController {
    private faceVerificationService;
    constructor(faceVerificationService: FaceVerificationService);
    verifyLiveFace(req: any, body: {
        imageBase64: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyHeadMovements(req: any, body: {
        leftImage: string;
        rightImage: string;
        upImage: string;
        downImage: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
}
