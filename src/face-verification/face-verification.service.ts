import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { AWSRekognitionService } from "./aws-rekognition.service";

// ✅ VERSION AVEC AWS REKOGNITION
// À utiliser quand les variables Railway sont configurées :
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET

@Injectable()
export class FaceVerificationService {
  private readonly strictMode: boolean;
  private readonly bypassEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private awsRekognition: AWSRekognitionService,
  ) {
    this.strictMode = process.env.FACE_VERIFICATION_STRICT !== "false";
    this.bypassEnabled = process.env.FACE_VERIFICATION_BYPASS !== "false";
  }

  private async approveFaceVerification(
    userId: string,
    faceImageUrl?: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        faceVerified: true,
        ...(faceImageUrl ? { faceImageUrl } : {}),
        accountStatus: 'DOCUMENTS_PENDING',
      },
    });

    await this.prisma.driverProfile
      .update({
        where: { userId },
        data: { faceVerified: true, faceVerifiedAt: new Date() },
      })
      .catch(() => undefined);
  }

  // Vérification live — étape 1 (image frontale)
  async verifyLiveFace(
    userId: string,
    imageBase64: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (this.bypassEnabled) {
        await this.approveFaceVerification(userId);
        return {
          success: true,
          message: "Vérification faciale validée (mode test bypass actif)",
        };
      }

      const envMinLiveConfidence = Number(
        process.env.FACE_LIVE_MIN_CONFIDENCE ?? (this.strictMode ? 90 : 70),
      );
      const minLiveConfidence = Number.isFinite(envMinLiveConfidence)
        ? Math.min(100, Math.max(0, envMinLiveConfidence))
        : this.strictMode
          ? 90
          : 70;

      if (!imageBase64 || imageBase64.length < 500) {
        return { success: false, message: "Image invalide. Réessayez." };
      }

      const { isLive, confidence } =
        await this.awsRekognition.detectLiveness(imageBase64);
      const liveCheckPassed = this.strictMode
        ? isLive && confidence >= minLiveConfidence
        : isLive || confidence >= minLiveConfidence;

      if (!liveCheckPassed) {
        return {
          success: false,
          message:
            "Visage non détecté correctement. Assurez-vous d'être bien éclairé et regardez la caméra.",
        };
      }

      // Upload sur S3
      const faceImageUrl = await this.awsRekognition.uploadFaceImage(
        userId,
        imageBase64,
      );

      await this.approveFaceVerification(userId, faceImageUrl);

      console.log(`✅ Face live verification OK: ${userId}`);
      return { success: true, message: "Visage vérifié avec succès" };
    } catch (error) {
      console.error("verifyLiveFace error:", error);
      return {
        success: false,
        message: "Erreur lors de la vérification du visage",
      };
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
      if (this.bypassEnabled) {
        await this.approveFaceVerification(userId);
        return {
          success: true,
          message: "Vérification faciale validée (mode test bypass actif)",
        };
      }

      const defaultMinSimilarity = this.strictMode ? 75 : 60;
      const envMinSimilarity = Number(
        process.env.FACE_MIN_SIMILARITY ?? defaultMinSimilarity,
      );
      const minSimilarity = Number.isFinite(envMinSimilarity)
        ? Math.min(100, Math.max(0, envMinSimilarity))
        : defaultMinSimilarity;

      const envRequiredMatches = Number(
        process.env.FACE_REQUIRED_MATCHES ?? (this.strictMode ? 2 : 1),
      );
      const requestedRequiredMatches = Number.isFinite(envRequiredMatches)
        ? Math.max(1, Math.floor(envRequiredMatches))
        : this.strictMode
          ? 2
          : 1;

      const images = [leftImage, rightImage, upImage, downImage].filter(
        (img) => img && img.length > 500,
      );

      if (images.length < 2) {
        return {
          success: false,
          message: "Veuillez compléter tous les mouvements de tête",
        };
      }

      // Comparer les images entre elles pour confirmer c'est la même personne
      const sourceImage = images[0];
      const similarities: number[] = [];

      for (let i = 1; i < images.length; i++) {
        const { similarity } = await this.awsRekognition.compareFaces(
          sourceImage,
          images[i],
        );
        similarities.push(similarity);
      }

      const validSimilarities = similarities.filter(
        (similarity) => similarity > 0,
      );
      const strongMatches = validSimilarities.filter(
        (similarity) => similarity >= minSimilarity,
      );
      const requiredMatches = Math.min(
        requestedRequiredMatches,
        similarities.length,
      );

      const avgSimilarity =
        validSimilarities.length > 0
          ? validSimilarities.reduce((a, b) => a + b, 0) /
            validSimilarities.length
          : 0;

      console.log(
        `AWS similarity check: valid=${validSimilarities.length}/${similarities.length} strong=${strongMatches.length}/${requiredMatches} avg=${avgSimilarity.toFixed(0)}% min=${minSimilarity}%`,
      );

      if (strongMatches.length < requiredMatches) {
        return {
          success: false,
          message: `Les images ne correspondent pas suffisamment à la même personne (score moyen ${avgSimilarity.toFixed(0)}%, seuil ${minSimilarity}%). Réessayez avec une bonne lumière, le visage bien centré, et évitez les mouvements brusques.`,
        };
      }

      // Upload de l'image principale sur S3
      const faceImageUrl = await this.awsRekognition.uploadFaceImage(
        userId,
        sourceImage,
      );

      await this.approveFaceVerification(userId, faceImageUrl);

      console.log(
        `✅ Face movements verification OK: ${userId} (similarity: ${avgSimilarity.toFixed(0)}%)`,
      );
      return { success: true, message: "Vérification faciale réussie" };
    } catch (error) {
      console.error("verifyHeadMovements error:", error);
      return { success: false, message: "Erreur lors de la vérification" };
    }
  }
}
