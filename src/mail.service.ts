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
}