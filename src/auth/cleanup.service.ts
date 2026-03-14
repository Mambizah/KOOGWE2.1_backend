import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AuthService } from './auth.service';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Nettoyage automatique des inscriptions incomplètes (sans @nestjs/schedule).
 * Tourne toutes les 6h via setInterval natif Node.js.
 */
@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly authService: AuthService) {}

  onModuleInit() {
    // Premier passage 1 minute après le démarrage (laisse Prisma se connecter)
    setTimeout(() => this.handleCleanup(), 60_000);
    // Puis toutes les 6h
    this.timer = setInterval(() => this.handleCleanup(), SIX_HOURS_MS);
    this.logger.log('✅ CleanupService démarré (intervalle: 6h)');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async handleCleanup() {
    this.logger.log('🧹 Nettoyage des inscriptions incomplètes...');
    try {
      await this.authService.cleanupIncompleteDriverRegistrations();
      this.logger.log('✅ Nettoyage terminé');
    } catch (err) {
      this.logger.error('❌ Erreur lors du nettoyage:', err);
    }
  }
}
