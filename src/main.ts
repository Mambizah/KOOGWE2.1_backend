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

  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Accept, Origin, X-Requested-With',
    );

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });

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
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Authorization'],
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

  try {
    const wsLib = require('ws');
    const wsServer = new wsLib.WebSocketServer({ noServer: true });
    const httpServer: any = app.getHttpServer();

    wsServer.on('connection', (socket: any) => {
      socket.send(JSON.stringify({ type: 'connected', channel: 'admin/ws' }));

      const interval = setInterval(() => {
        if (socket.readyState === wsLib.WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }));
        }
      }, 15000);

      socket.on('close', () => {
        clearInterval(interval);
      });
    });

    httpServer.on('upgrade', (request: any, socket: any, head: any) => {
      const url: string = request.url || '';
      if (!url.startsWith('/admin/ws')) {
        return;
      }

      wsServer.handleUpgrade(request, socket, head, (ws: any) => {
        wsServer.emit('connection', ws, request);
      });
    });

    console.log('✅ Native WebSocket /admin/ws activé');
  } catch (error) {
    console.warn('⚠️ WebSocket natif /admin/ws non activé:', error);
  }

  console.log(`🚀 Koogwe Backend démarré sur le port ${port}`);
  console.log(`📱 Mode: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();