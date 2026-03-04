import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FaceVerificationController } from './face-verification.controller';
import { FaceVerificationService } from './face-verification.service';
import { AWSRekognitionService } from './aws-rekognition.service';
import { PrismaService } from '../prisma.service';

// ✅ VERSION AVEC AWS — à utiliser quand les variables Railway sont configurées

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN', '1d') as any },
      }),
    }),
  ],
  controllers: [FaceVerificationController],
  providers: [FaceVerificationService, AWSRekognitionService, PrismaService],
  exports: [FaceVerificationService],
})
export class FaceVerificationModule {}