import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail.service';
import { CreateAuthDto } from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  // ---- INSCRIPTION ----
  async create(createAuthDto: CreateAuthDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createAuthDto.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashedPassword = await bcrypt.hash(createAuthDto.password, 12);
    const isDriver = createAuthDto.role === 'DRIVER';

    const newUser = await this.prisma.user.create({
      data: {
        email: createAuthDto.email,
        name: createAuthDto.name,
        password: hashedPassword,
        phone: createAuthDto.phone,
        role: createAuthDto.role ?? 'PASSENGER',
        // ✅ Compte activé directement — pas de vérification email
        isVerified: true,
        accountStatus: 'EMAIL_VERIFIED',
        wallet: { create: {} },
        driverProfile: isDriver ? { create: {} } : undefined,
      },
    });

    console.log('✅ Nouveau compte créé:', newUser.email, '| Rôle:', newUser.role);

    await this.mailService.sendVerificationCode(newUser.email, '000000');
    if (newUser.name) {
      await this.mailService.sendWelcomeEmail(newUser.email, newUser.name);
    }

    // ✅ Token retourné directement — l'app navigue sans OTP
    const payload = { sub: newUser.id, email: newUser.email, role: newUser.role };
    const access_token = await this.jwtService.signAsync(payload);

    return {
      message: 'Compte créé avec succès',
      email: newUser.email,
      access_token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        accountStatus: newUser.accountStatus,
      },
    };
  }

  // ---- VÉRIFICATION EMAIL (désactivée — retourne token sans vérifier code) ----
  async verifyEmail(email: string, _code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Email introuvable');

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      message: 'Compte vérifié',
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    };
  }

  // ---- RENVOI CODE OTP (désactivé) ----
  async resendOtp(_email: string) {
    return { message: 'Code renvoyé avec succès' };
  }

  // ---- CONNEXION ----
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorizedException('Email incorrect');
    if (!user.isVerified)
      throw new UnauthorizedException('Compte non activé. Contactez le support.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Mot de passe incorrect');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    };
  }

  async adminLogin(email: string, password: string) {
    const response = await this.login(email, password);
    if (response.user.role !== 'ADMIN') {
      throw new UnauthorizedException('Accès réservé aux administrateurs');
    }
    return response;
  }
}