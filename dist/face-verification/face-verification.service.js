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
exports.FaceVerificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const aws_rekognition_service_1 = require("./aws-rekognition.service");
let FaceVerificationService = class FaceVerificationService {
    constructor(prisma, awsRekognition) {
        this.prisma = prisma;
        this.awsRekognition = awsRekognition;
    }
    async verifyLiveFace(userId, imageBase64) {
        try {
            const { isLive, confidence } = await this.awsRekognition.detectLiveness(imageBase64);
            if (!isLive || confidence < 95) {
                return {
                    success: false,
                    message: 'Visage non détecté correctement. Veuillez réessayer.',
                };
            }
            const faceImageUrl = await this.awsRekognition.uploadFaceImage(userId, imageBase64);
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    faceVerified: true,
                    faceImageUrl,
                    accountStatus: 'DOCUMENTS_PENDING',
                },
            });
            return {
                success: true,
                message: 'Visage vérifié avec succès',
            };
        }
        catch (error) {
            console.error('Erreur de vérification du visage :', error);
            return {
                success: false,
                message: 'Erreur lors de la vérification du visage',
            };
        }
    }
    async verifyHeadMovements(userId, leftImage, rightImage, upImage, downImage) {
        try {
            const similarity1 = await this.awsRekognition.compareFaces(leftImage, rightImage);
            const similarity2 = await this.awsRekognition.compareFaces(leftImage, upImage);
            const similarity3 = await this.awsRekognition.compareFaces(leftImage, downImage);
            const avgSimilarity = (similarity1.similarity + similarity2.similarity + similarity3.similarity) / 3;
            if (avgSimilarity < 90) {
                return {
                    success: false,
                    message: 'Les images ne correspondent pas à la même personne',
                };
            }
            const faceImageUrl = await this.awsRekognition.uploadFaceImage(userId, leftImage);
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    faceVerified: true,
                    faceImageUrl,
                    accountStatus: 'DOCUMENTS_PENDING',
                },
            });
            return {
                success: true,
                message: 'Vérification faciale terminée avec succès',
            };
        }
        catch (error) {
            console.error('Erreur de vérification des mouvements :', error);
            return {
                success: false,
                message: 'Erreur lors de la vérification',
            };
        }
    }
};
exports.FaceVerificationService = FaceVerificationService;
exports.FaceVerificationService = FaceVerificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aws_rekognition_service_1.AWSRekognitionService])
], FaceVerificationService);
//# sourceMappingURL=face-verification.service.js.map