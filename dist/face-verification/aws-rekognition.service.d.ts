export declare class AWSRekognitionService {
    private rekognition;
    private s3;
    private region;
    private readonly uploadsRoot;
    private readonly useAws;
    constructor();
    detectLiveness(imageBase64: string): Promise<{
        isLive: boolean;
        confidence: number;
    }>;
    uploadFaceImage(userId: string, imageBase64: string): Promise<string>;
    compareFaces(sourceImageBase64: string, targetImageBase64: string): Promise<{
        similarity: number;
    }>;
}
