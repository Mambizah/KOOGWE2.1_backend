import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service';

/**
 * Service de nettoyage automatique des inscriptions incomplètes.
 * 
 * Un chauffeur qui s'inscrit (nom, email, tel, mot de passe) mais
 * ne termine pas les étapes suivantes (vérification faciale, documents,
 * véhicule) ne doit pas rester en base de données.
 * 
 * Ce service supprime toutes les 6h les chauffeurs restés en état
 * FACE_VERIFICATION_PENDING depuis plus de 24h.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly authService: AuthService) {}

  @Cron(CronExpression.EVERY_6_HOURS)
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
