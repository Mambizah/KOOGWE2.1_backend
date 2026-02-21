"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AWSRekognitionService = void 0;
const common_1 = require("@nestjs/common");
const client_rekognition_1 = require("@aws-sdk/client-rekognition");
const client_s3_1 = require("@aws-sdk/client-s3");
let AWSRekognitionService = class AWSRekognitionService {
    constructor() {
        const config = {
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        };
        this.rekognition = new client_rekognition_1.RekognitionClient(config);
        this.s3 = new client_s3_1.S3Client(config);
    }
    async detectLiveness(imageBase64) {
        try {
            const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const command = new client_rekognition_1.DetectFacesCommand({
                Image: { Bytes: buffer },
                Attributes: ['ALL'],
            });
            const result = await this.rekognition.send(command);
            if (!result.FaceDetails || result.FaceDetails.length === 0) {
                return { isLive: false, confidence: 0 };
            }
            const face = result.FaceDetails[0];
            const hasGoodQuality = face.Quality?.Brightness > 50 &&
                face.Quality?.Sharpness > 50;
            const isWellPositioned = face.Pose?.Pitch < 30 && face.Pose?.Pitch > -30 &&
                face.Pose?.Roll < 30 && face.Pose?.Roll > -30 &&
                face.Pose?.Yaw < 30 && face.Pose?.Yaw > -30;
            const eyesOpen = face.EyesOpen?.Value &&
                face.EyesOpen?.Confidence > 90;
            const isLive = hasGoodQuality && isWellPositioned && eyesOpen;
            const confidence = face.Confidence ?? 0;
            return { isLive: !!isLive, confidence };
        }
        catch (error) {
            console.error('Erreur détection liveness :', error);
            return { isLive: false, confidence: 0 };
        }
    }
    async uploadFaceImage(userId, imageBase64) {
        try {
            const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const key = `faces/${userId}/${Date.now()}.jpg`;
            const command = new client_s3_1.PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: key,
                Body: buffer,
                ContentType: 'image/jpeg',
            });
            await this.s3.send(command);
            return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
        }
        catch (error) {
            console.error("Erreur upload image :", error);
            throw error;
        }
    }
    async compareFaces(sourceImageBase64, targetImageBase64) {
        try {
            const sourceBuffer = Buffer.from(sourceImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const targetBuffer = Buffer.from(targetImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const command = new client_rekognition_1.CompareFacesCommand({
                SourceImage: { Bytes: sourceBuffer },
                TargetImage: { Bytes: targetBuffer },
                SimilarityThreshold: 90,
            });
            const result = await this.rekognition.send(command);
            if (result.FaceMatches && result.FaceMatches.length > 0) {
                return { similarity: result.FaceMatches[0].Similarity ?? 0 };
            }
            return { similarity: 0 };
        }
        catch (error) {
            console.error('Erreur comparaison visages :', error);
            return { similarity: 0 };
        }
    }
};
exports.AWSRekognitionService = AWSRekognitionService;
exports.AWSRekognitionService = AWSRekognitionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AWSRekognitionService);
//# sourceMappingURL=aws-rekognition.service.js.map