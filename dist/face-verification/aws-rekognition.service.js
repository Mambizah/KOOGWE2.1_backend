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
const promises_1 = require("fs/promises");
const path_1 = require("path");
let AWSRekognitionService = class AWSRekognitionService {
    constructor() {
        this.uploadsRoot = (0, path_1.join)(process.cwd(), 'uploads');
        this.region = process.env.AWS_REGION || 'eu-west-3';
        this.useAws = Boolean(process.env.AWS_ACCESS_KEY_ID
            && process.env.AWS_SECRET_ACCESS_KEY
            && process.env.AWS_S3_BUCKET);
        if (this.useAws) {
            const config = {
                region: this.region,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                },
            };
            this.rekognition = new client_rekognition_1.RekognitionClient(config);
            this.s3 = new client_s3_1.S3Client(config);
            console.log('✅ AWS Rekognition/S3 activé');
        }
        else {
            console.warn('⚠️ AWS non configuré: mode stockage local activé pour les tests');
            this.rekognition = {};
            this.s3 = {};
        }
    }
    async detectLiveness(imageBase64) {
        if (!this.useAws) {
            return { isLive: true, confidence: 99 };
        }
        try {
            const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const command = new client_rekognition_1.DetectFacesCommand({
                Image: { Bytes: buffer },
                Attributes: ['ALL'],
            });
            const result = await this.rekognition.send(command);
            if (!result.FaceDetails || result.FaceDetails.length === 0) {
                console.log('⚠️ AWS: Aucun visage détecté dans l\'image');
                return { isLive: false, confidence: 0 };
            }
            const face = result.FaceDetails[0];
            const brightness = face.Quality?.Brightness ?? 0;
            const sharpness = face.Quality?.Sharpness ?? 0;
            const pitch = face.Pose?.Pitch ?? 0;
            const roll = face.Pose?.Roll ?? 0;
            const yaw = face.Pose?.Yaw ?? 0;
            const eyesOpenValue = face.EyesOpen?.Value ?? false;
            const eyesOpenConfidence = face.EyesOpen?.Confidence ?? 0;
            const hasGoodQuality = brightness > 40 && sharpness > 40;
            const isWellPositioned = Math.abs(pitch) < 35 && Math.abs(roll) < 35 && Math.abs(yaw) < 35;
            const eyesOpen = eyesOpenValue && eyesOpenConfidence > 85;
            const isLive = hasGoodQuality && isWellPositioned && eyesOpen;
            const confidence = face.Confidence ?? 0;
            console.log(`✅ AWS Liveness: brightness=${brightness.toFixed(0)} sharpness=${sharpness.toFixed(0)} isLive=${isLive} confidence=${confidence.toFixed(0)}`);
            return { isLive: !!isLive, confidence };
        }
        catch (error) {
            console.error('❌ AWS detectLiveness error:', error);
            return { isLive: false, confidence: 0 };
        }
    }
    async uploadFaceImage(userId, imageBase64) {
        if (!this.useAws) {
            const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const dir = (0, path_1.join)(this.uploadsRoot, 'faces', userId);
            await (0, promises_1.mkdir)(dir, { recursive: true });
            const filename = `${Date.now()}.jpg`;
            const fullPath = (0, path_1.join)(dir, filename);
            await (0, promises_1.writeFile)(fullPath, buffer);
            const publicBase = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            return `${publicBase}/uploads/faces/${userId}/${filename}`;
        }
        try {
            const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const bucket = process.env.AWS_S3_BUCKET;
            const key = `faces/${userId}/${Date.now()}.jpg`;
            const command = new client_s3_1.PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: buffer,
                ContentType: 'image/jpeg',
            });
            await this.s3.send(command);
            const url = this.region === 'us-east-1'
                ? `https://${bucket}.s3.amazonaws.com/${key}`
                : `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;
            console.log(`✅ AWS S3 upload OK: ${url}`);
            return url;
        }
        catch (error) {
            console.error('❌ AWS S3 upload error:', error);
            throw error;
        }
    }
    async compareFaces(sourceImageBase64, targetImageBase64) {
        if (!this.useAws) {
            if (!sourceImageBase64 || !targetImageBase64)
                return { similarity: 0 };
            return { similarity: 99 };
        }
        try {
            const sourceBuffer = Buffer.from(sourceImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const targetBuffer = Buffer.from(targetImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const command = new client_rekognition_1.CompareFacesCommand({
                SourceImage: { Bytes: sourceBuffer },
                TargetImage: { Bytes: targetBuffer },
                SimilarityThreshold: 80,
            });
            const result = await this.rekognition.send(command);
            if (result.FaceMatches && result.FaceMatches.length > 0) {
                const similarity = result.FaceMatches[0].Similarity ?? 0;
                console.log(`✅ AWS compareFaces: similarity=${similarity.toFixed(0)}%`);
                return { similarity };
            }
            console.log('⚠️ AWS compareFaces: aucune correspondance');
            return { similarity: 0 };
        }
        catch (error) {
            if (error?.name === 'InvalidParameterException') {
                console.warn('⚠️ AWS: visage non détectable dans une image');
                return { similarity: 0 };
            }
            console.error('❌ AWS compareFaces error:', error);
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