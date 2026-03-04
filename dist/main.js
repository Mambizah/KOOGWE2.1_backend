"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
dotenv.config();
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const prisma_service_1 = require("./prisma.service");
const fs_1 = require("fs");
const path_1 = require("path");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use(require('express').json({ limit: '50mb' }));
    app.use(require('express').urlencoded({ limit: '50mb', extended: true }));
    const uploadsDir = (0, path_1.join)(process.cwd(), 'uploads');
    if (!(0, fs_1.existsSync)(uploadsDir)) {
        (0, fs_1.mkdirSync)(uploadsDir, { recursive: true });
    }
    app.use('/uploads', require('express').static(uploadsDir));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
    }));
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:42559',
        'http://localhost:8080',
        'http://localhost:57570',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:42559',
        'http://10.0.2.2:3000',
    ];
    if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
    }
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin))
                return callback(null, true);
            console.warn(`⚠️ CORS bloqué pour origin: ${origin}`);
            callback(null, true);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
        const prisma = app.get(prisma_service_1.PrismaService);
        const bcrypt = await Promise.resolve().then(() => require('bcrypt'));
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
    }
    else {
        console.log('ℹ️ ADMIN_EMAIL/ADMIN_PASSWORD non définis: bootstrap admin ignoré');
    }
    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Koogwe Backend démarré sur le port ${port}`);
    console.log(`📱 Mode: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
//# sourceMappingURL=main.js.map