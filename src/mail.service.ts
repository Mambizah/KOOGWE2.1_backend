import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(private configService: ConfigService) {}

  // ✅ Email désactivé — Railway bloque SMTP
  // À réactiver quand un domaine sera configuré sur Resend/Brevo
  async sendVerificationCode(email: string, code: string): Promise<void> {
    console.log(`📧 [EMAIL DÉSACTIVÉ] Code OTP: ${code} pour: ${email}`);
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    console.log(`📧 [EMAIL DÉSACTIVÉ] Bienvenue ${name} (${email})`);
  }

  async sendRideValidationEmail(
    email: string,
    payload: { rideId: string; status: string; price: number; vehicleType: string },
  ): Promise<void> {
    console.log(
      `📧 [EMAIL DÉSACTIVÉ] Validation course ${payload.rideId} (${payload.vehicleType}) ${payload.price}€ -> ${email}`,
    );
  }

  async sendDriverAssignedEmail(
    email: string,
    payload: { rideId: string; driverName: string; driverPhone?: string },
  ): Promise<void> {
    console.log(
      `📧 [EMAIL DÉSACTIVÉ] Chauffeur assigné course ${payload.rideId}: ${payload.driverName} (${payload.driverPhone ?? 'N/A'}) -> ${email}`,
    );
  }

  async sendRideCancelledEmail(email: string, payload: { rideId: string }): Promise<void> {
    console.log(`📧 [EMAIL DÉSACTIVÉ] Course annulée ${payload.rideId} -> ${email}`);
  }

  async sendRideCompletedEmail(
    email: string,
    payload: { rideId: string; price: number },
  ): Promise<void> {
    console.log(`📧 [EMAIL DÉSACTIVÉ] Course terminée ${payload.rideId}, reçu ${payload.price}€ -> ${email}`);
  }
}