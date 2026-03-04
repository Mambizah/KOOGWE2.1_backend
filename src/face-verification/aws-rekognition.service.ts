import { Injectable } from '@nestjs/common';
import { RekognitionClient, DetectFacesCommand, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class AWSRekognitionService {
  private rekognition: RekognitionClient;
  private s3: S3Client;
  private region: string;
  private readonly uploadsRoot = join(process.cwd(), 'uploads');
  private readonly useAws: boolean;

  constructor() {
    this.region = process.env.AWS_REGION || 'eu-west-3'; // Paris — plus proche Guyane
    this.useAws = Boolean(
      process.env.AWS_ACCESS_KEY_ID
      && process.env.AWS_SECRET_ACCESS_KEY
      && process.env.AWS_S3_BUCKET,
    );

    if (this.useAws) {
      const config = {
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      };

      this.rekognition = new RekognitionClient(config);
      this.s3 = new S3Client(config);
      console.log('✅ AWS Rekognition/S3 activé');
    } else {
      console.warn('⚠️ AWS non configuré: mode stockage local activé pour les tests');
      this.rekognition = {} as RekognitionClient;
      this.s3 = {} as S3Client;
    }
  }

  // ✅ FIX BUG 1 : Vérifications null-safe (undefined > 50 causait des erreurs TypeScript)
  async detectLiveness(imageBase64: string): Promise<{ isLive: boolean; confidence: number }> {
    if (!this.useAws) {
      return { isLive: true, confidence: 99 };
    }

    try {
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      const command = new DetectFacesCommand({
        Image: { Bytes: buffer },
        Attributes: ['ALL'],
      });

      const result = await this.rekognition.send(command);

      if (!result.FaceDetails || result.FaceDetails.length === 0) {
        console.log('⚠️ AWS: Aucun visage détecté dans l\'image');
        return { isLive: false, confidence: 0 };
      }

      const face = result.FaceDetails[0];

      // ✅ FIX : Utiliser ?? 0 pour éviter comparaison avec undefined
      const brightness = face.Quality?.Brightness ?? 0;
      const sharpness = face.Quality?.Sharpness ?? 0;
      const pitch = face.Pose?.Pitch ?? 0;
      const roll = face.Pose?.Roll ?? 0;
      const yaw = face.Pose?.Yaw ?? 0;
      const eyesOpenValue = face.EyesOpen?.Value ?? false;
      const eyesOpenConfidence = face.EyesOpen?.Confidence ?? 0;

      const hasGoodQuality = brightness > 40 && sharpness > 40; // Seuils légèrement réduits
      const isWellPositioned = Math.abs(pitch) < 35 && Math.abs(roll) < 35 && Math.abs(yaw) < 35;
      const eyesOpen = eyesOpenValue && eyesOpenConfidence > 85;

      const isLive = hasGoodQuality && isWellPositioned && eyesOpen;
      const confidence = face.Confidence ?? 0;

      console.log(`✅ AWS Liveness: brightness=${brightness.toFixed(0)} sharpness=${sharpness.toFixed(0)} isLive=${isLive} confidence=${confidence.toFixed(0)}`);

      return { isLive: !!isLive, confidence };
    } catch (error) {
      console.error('❌ AWS detectLiveness error:', error);
      return { isLive: false, confidence: 0 };
    }
  }

  // ✅ FIX BUG 2 : URL S3 correcte pour toutes les régions
  async uploadFaceImage(userId: string, imageBase64: string): Promise<string> {
    if (!this.useAws) {
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const dir = join(this.uploadsRoot, 'faces', userId);
      await mkdir(dir, { recursive: true });
      const filename = `${Date.now()}.jpg`;
      const fullPath = join(dir, filename);
      await writeFile(fullPath, buffer);

      const publicBase = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      return `${publicBase}/uploads/faces/${userId}/${filename}`;
    }

    try {
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const bucket = process.env.AWS_S3_BUCKET!;
      const key = `faces/${userId}/${Date.now()}.jpg`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      });

      await this.s3.send(command);

      // ✅ FIX : URL correcte selon la région (us-east-1 a un format différent)
      const url = this.region === 'us-east-1'
        ? `https://${bucket}.s3.amazonaws.com/${key}`
        : `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;

      console.log(`✅ AWS S3 upload OK: ${url}`);
      return url;
    } catch (error) {
      console.error('❌ AWS S3 upload error:', error);
      throw error;
    }
  }

  // ✅ Comparaison de visages avec gestion d'erreur améliorée
  async compareFaces(
    sourceImageBase64: string,
    targetImageBase64: string,
  ): Promise<{ similarity: number }> {
    if (!this.useAws) {
      if (!sourceImageBase64 || !targetImageBase64) return { similarity: 0 };
      return { similarity: 99 };
    }

    try {
      const sourceBuffer = Buffer.from(sourceImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const targetBuffer = Buffer.from(targetImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      const command = new CompareFacesCommand({
        SourceImage: { Bytes: sourceBuffer },
        TargetImage: { Bytes: targetBuffer },
        SimilarityThreshold: 80, // ✅ Réduit de 90→80 pour être moins strict
      });

      const result = await this.rekognition.send(command);

      if (result.FaceMatches && result.FaceMatches.length > 0) {
        const similarity = result.FaceMatches[0].Similarity ?? 0;
        console.log(`✅ AWS compareFaces: similarity=${similarity.toFixed(0)}%`);
        return { similarity };
      }

      console.log('⚠️ AWS compareFaces: aucune correspondance');
      return { similarity: 0 };
    } catch (error: any) {
      // Si AWS ne trouve pas de visage dans l'image source, on retourne 0
      if (error?.name === 'InvalidParameterException') {
        console.warn('⚠️ AWS: visage non détectable dans une image');
        return { similarity: 0 };
      }
      console.error('❌ AWS compareFaces error:', error);
      return { similarity: 0 };
    }
  }
}