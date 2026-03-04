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
            if (!imageBase64 || imageBase64.length < 500) {
                return { success: false, message: 'Image invalide. Réessayez.' };
            }
            const { isLive, confidence } = await this.awsRekognition.detectLiveness(imageBase64);
            if (!isLive || confidence < 90) {
                return {
                    success: false,
                    message: 'Visage non détecté correctement. Assurez-vous d\'être bien éclairé et regardez la caméra.',
                };
            }
            const faceImageUrl = await this.awsRekognition.uploadFaceImage(userId, imageBase64);
            await this.prisma.user.update({
                where: { id: userId },
                data: { faceVerified: true, faceImageUrl, accountStatus: 'DOCUMENTS_PENDING' },
            });
            console.log(`✅ Face live verification OK: ${userId}`);
            return { success: true, message: 'Visage vérifié avec succès' };
        }
        catch (error) {
            console.error('verifyLiveFace error:', error);
            return { success: false, message: 'Erreur lors de la vérification du visage' };
        }
    }
    async verifyHeadMovements(userId, leftImage, rightImage, upImage, downImage) {
        try {
            const images = [leftImage, rightImage, upImage, downImage].filter(img => img && img.length > 500);
            if (images.length < 2) {
                return { success: false, message: 'Veuillez compléter tous les mouvements de tête' };
            }
            const sourceImage = images[0];
            const similarities = [];
            for (let i = 1; i < images.length; i++) {
                const { similarity } = await this.awsRekognition.compareFaces(sourceImage, images[i]);
                similarities.push(similarity);
            }
            const avgSimilarity = similarities.length > 0
                ? similarities.reduce((a, b) => a + b, 0) / similarities.length
                : 0;
            console.log(`AWS avg similarity: ${avgSimilarity.toFixed(0)}%`);
            if (avgSimilarity < 75) {
                return {
                    success: false,
                    message: `Les images ne correspondent pas à la même personne (${avgSimilarity.toFixed(0)}%). Réessayez dans de meilleures conditions d'éclairage.`,
                };
            }
            const faceImageUrl = await this.awsRekognition.uploadFaceImage(userId, sourceImage);
            await this.prisma.user.update({
                where: { id: userId },
                data: { faceVerified: true, faceImageUrl, accountStatus: 'DOCUMENTS_PENDING' },
            });
            await this.prisma.driverProfile
                .update({
                where: { userId },
                data: { faceVerified: true, faceVerifiedAt: new Date() },
            })
                .catch(() => undefined);
            console.log(`✅ Face movements verification OK: ${userId} (similarity: ${avgSimilarity.toFixed(0)}%)`);
            return { success: true, message: 'Vérification faciale réussie' };
        }
        catch (error) {
            console.error('verifyHeadMovements error:', error);
            return { success: false, message: 'Erreur lors de la vérification' };
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