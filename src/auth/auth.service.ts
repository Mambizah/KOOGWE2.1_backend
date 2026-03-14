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
import { AccountStatus } from '@prisma/client';

// Durée maximale autorisée pour une inscription incomplète (24h)
const INCOMPLETE_REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  // ---- NETTOYAGE des inscriptions incomplètes ----
  // Un chauffeur est "incomplet" s'il n'a pas de vérification faciale après 24h
  async cleanupIncompleteDriverRegistrations(): Promise<void> {
    const cutoff = new Date(Date.now() - INCOMPLETE_REGISTRATION_TTL_MS);
    const incomplete = await this.prisma.user.findMany({
      where: {
        role: 'DRIVER',
        accountStatus: AccountStatus.FACE_VERIFICATION_PENDING,
        createdAt: { lt: cutoff },
      },
      select: { id: true, email: true },
    });

    for (const user of incomplete) {
      await this.prisma.user.delete({ where: { id: user.id } }).catch(() => null);
      console.log(`🗑️ Inscription incomplète supprimée: ${user.email}`);
    }
  }

  // ---- INSCRIPTION ----
  async create(createAuthDto: CreateAuthDto) {
    const normalizedEmail = createAuthDto.email.trim().toLowerCase();
    const isDriver = createAuthDto.role === 'DRIVER';

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      // Si c'est un chauffeur incomplet (jamais terminé son onboarding), on le supprime
      // pour permettre une nouvelle inscription avec le même email
      if (
        existing.role === 'DRIVER' &&
        existing.accountStatus === AccountStatus.FACE_VERIFICATION_PENDING
      ) {
        await this.prisma.user.delete({ where: { id: existing.id } }).catch(() => null);
        console.log(`🔄 Ancienne inscription incomplète supprimée pour: ${normalizedEmail}`);
      } else {
        throw new ConflictException('Cet email est déjà utilisé');
      }
    }

    const hashedPassword = await bcrypt.hash(createAuthDto.password, 12);

    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: createAuthDto.name,
        password: hashedPassword,
        phone: createAuthDto.phone,
        role: createAuthDto.role ?? 'PASSENGER',
        // Chauffeur: non vérifié jusqu'à validation admin complète
        // Passager: activé immédiatement
        isVerified: isDriver ? false : true,
        accountStatus: isDriver ? AccountStatus.FACE_VERIFICATION_PENDING : 'EMAIL_VERIFIED' as any,
        wallet: { create: {} },
        driverProfile: isDriver ? { create: {} } : undefined,
      },
    });

    console.log('✅ Nouveau compte créé:', newUser.email, '| Rôle:', newUser.role);

    if (newUser.name) {
      await this.mailService.sendWelcomeEmail(newUser.email, newUser.name).catch(() => null);
    }

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
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) throw new UnauthorizedException('Email incorrect');

    // BUG FIX: Un chauffeur avec accountStatus ACTIVE doit pouvoir se connecter
    // même si isVerified est false (l'admin a validé via accountStatus, pas isVerified)
    const isDriverActive = user.role === 'DRIVER' && user.accountStatus === AccountStatus.ACTIVE;
    const isPassengerVerified = user.role !== 'DRIVER' && user.isVerified;

    if (!isDriverActive && !isPassengerVerified) {
      if (user.accountStatus === AccountStatus.FACE_VERIFICATION_PENDING) {
        throw new UnauthorizedException('Veuillez compléter la vérification faciale.');
      }
      if (user.accountStatus === 'DOCUMENTS_PENDING' as any) {
        throw new UnauthorizedException('Veuillez envoyer vos documents.');
      }
      if (user.accountStatus === 'ADMIN_REVIEW_PENDING' as any) {
        throw new UnauthorizedException('Votre dossier est en cours de vérification par l\'administrateur.');
      }
      if (user.accountStatus === AccountStatus.REJECTED) {
        throw new UnauthorizedException('Votre compte a été refusé. Contactez le support.');
      }
      throw new UnauthorizedException('Compte non activé. Contactez le support.');
    }

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
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) throw new UnauthorizedException('Email incorrect');
    if (user.role !== 'ADMIN') throw new UnauthorizedException('Accès réservé aux administrateurs');
    if (!user.isVerified) throw new UnauthorizedException('Compte non activé.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Mot de passe incorrect');

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
}
