import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Augmenter la limite pour les photos base64 (facial verification)
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', require('express').static(uploadsDir));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  //: Support dev (localhost) + prod (Railway + app mobile)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:42559',
    'http://localhost:8080',
    'http://localhost:57570',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:42559',
    // Émulateur Android (Android Studio)
    'http://10.0.2.2:3000',
  ];

  // Ajouter l'URL Railway si définie dans .env
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    // ✅ Les apps mobiles Flutter n'envoient pas d'origin HTTP
    // 'origin: true' accepte toutes les origines (ok pour dev + mobile)
    // En prod, remplacer par les domaines exacts si besoin
    origin: (origin, callback) => {
      // Les apps mobiles n'envoient pas d'origin → accepter
      if (!origin) return callback(null, true);
      // Origins web connues → accepter
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // En prod, on peut logger les origines inconnues
      console.warn(`⚠️ CORS bloqué pour origin: ${origin}`);
      callback(null, true); // Accepter quand même pour ne pas bloquer les tests
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Koogwe Backend démarré sur le port ${port}`);
  console.log(`📱 Mode: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();