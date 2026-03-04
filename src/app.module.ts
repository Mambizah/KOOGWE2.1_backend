import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RidesModule } from './rides/rides.module';
import { FaceVerificationModule } from './face-verification/face-verification.module';
import { WalletModule } from './wallet/wallet.module';
import { DocumentsModule } from './documents/documents.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Variables d'environnement requises :
      // DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN,
      // GMAIL_USER, GMAIL_PASS,
      // AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET,
      // STRIPE_SECRET_KEY
    }),
    AuthModule,
    UsersModule,
    RidesModule,
    FaceVerificationModule,
    WalletModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}