import { Module } from '@nestjs/common';
import { FaceVerificationController } from './face-verification.controller';
import { FaceVerificationService } from './face-verification.service';
import { AWSRekognitionService } from './aws-rekognition.service';
import { PrismaService } from '../prisma.service';

// ✅ VERSION AVEC AWS — à utiliser quand les variables Railway sont configurées

@Module({
  controllers: [FaceVerificationController],
  providers: [FaceVerificationService, AWSRekognitionService, PrismaService],
  exports: [FaceVerificationService],
})
export class FaceVerificationModule {}