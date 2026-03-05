import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return;

  const fallbackUrl = process.env.DATABASE_PRIVATE_URL
    || process.env.DATABASE_PUBLIC_URL
    || process.env.POSTGRES_URL;

  if (fallbackUrl) {
    process.env.DATABASE_URL = fallbackUrl;
    console.warn('⚠️ DATABASE_URL absent, fallback appliqué depuis DATABASE_PRIVATE_URL/DATABASE_PUBLIC_URL/POSTGRES_URL');
    return;
  }

  const {
    PGHOST,
    PGPORT,
    PGUSER,
    PGPASSWORD,
    PGDATABASE,
  } = process.env;

  if (PGHOST && PGPORT && PGUSER && PGPASSWORD && PGDATABASE) {
    const user = encodeURIComponent(PGUSER);
    const pass = encodeURIComponent(PGPASSWORD);
    process.env.DATABASE_URL = `postgresql://${user}:${pass}@${PGHOST}:${PGPORT}/${PGDATABASE}?schema=public`;
    console.warn('⚠️ DATABASE_URL reconstruit depuis les variables PG*');
  }
}

async function bootstrap() {
  ensureDatabaseUrl();
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
    'https://koogwe2-1-admin.vercel.app',
  ];

  // Ajouter les URLs frontend définies dans .env
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }
  if (process.env.FRONTEND_URLS) {
    const urls = process.env.FRONTEND_URLS
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    allowedOrigins.push(...urls);
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
      // Log d'observabilité: origine non listée, mais temporairement acceptée
      console.warn(`⚠️ CORS origine non listée (acceptée): ${origin}`);
      callback(null, true); // Accepter pour éviter les blocages web/mobile
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const prisma = app.get(PrismaService);
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true,
        accountStatus: 'ACTIVE',
      },
      create: {
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true,
        accountStatus: 'ACTIVE',
        wallet: { create: {} },
      },
    });

    console.log(`✅ Compte admin prêt: ${adminEmail}`);
  } else {
    console.log('ℹ️ ADMIN_EMAIL/ADMIN_PASSWORD non définis: bootstrap admin ignoré');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Koogwe Backend démarré sur le port ${port}`);
  console.log(`📱 Mode: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();