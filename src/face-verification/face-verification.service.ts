import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AWSRekognitionService } from './aws-rekognition.service';

// ✅ VERSION AVEC AWS REKOGNITION
// À utiliser quand les variables Railway sont configurées :
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET

@Injectable()
export class FaceVerificationService {
  constructor(
    private prisma: PrismaService,
    private awsRekognition: AWSRekognitionService,
  ) {}

  // Vérification live — étape 1 (image frontale)
  async verifyLiveFace(
    userId: string,
    imageBase64: string,
  ): Promise<{ success: boolean; message: string }> {
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

      // Upload sur S3
      const faceImageUrl = await this.awsRekognition.uploadFaceImage(userId, imageBase64);

      await this.prisma.user.update({
        where: { id: userId },
        data: { faceVerified: true, faceImageUrl, accountStatus: 'DOCUMENTS_PENDING' },
      });

      console.log(`✅ Face live verification OK: ${userId}`);
      return { success: true, message: 'Visage vérifié avec succès' };
    } catch (error) {
      console.error('verifyLiveFace error:', error);
      return { success: false, message: 'Erreur lors de la vérification du visage' };
    }
  }

  // Vérification mouvements — étape 2 (gauche, droite, haut, bas)
  async verifyHeadMovements(
    userId: string,
    leftImage: string,
    rightImage: string,
    upImage: string,
    downImage: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const images = [leftImage, rightImage, upImage, downImage].filter(
        img => img && img.length > 500,
      );

      if (images.length < 2) {
        return { success: false, message: 'Veuillez compléter tous les mouvements de tête' };
      }

      // Comparer les images entre elles pour confirmer c'est la même personne
      const sourceImage = images[0];
      const similarities: number[] = [];

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

      // Upload de l'image principale sur S3
      const faceImageUrl = await this.awsRekognition.uploadFaceImage(userId, sourceImage);

      // Marquer comme vérifié
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
    } catch (error) {
      console.error('verifyHeadMovements error:', error);
      return { success: false, message: 'Erreur lors de la vérification' };
    }
  }
}