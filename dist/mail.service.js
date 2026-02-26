"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = require("nodemailer");
let MailService = class MailService {
    constructor(configService) {
        this.configService = configService;
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: this.configService.get('GMAIL_USER'),
                pass: this.configService.get('GMAIL_PASS'),
            },
        });
    }
    async sendVerificationCode(email, code) {
        try {
            await this.transporter.sendMail({
                from: `"Koogwz Security" <${this.configService.get('GMAIL_USER')}>`,
                to: email,
                subject: 'Vérifiez votre compte Koogwz',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f5f3ff; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #6C3CE1; font-size: 28px;">Koogwz 🚗</h2>
            </div>
            <div style="background: white; border-radius: 12px; padding: 24px; text-align: center;">
              <p style="color: #6B7280; font-size: 15px; margin-bottom: 16px;">Voici votre code de validation :</p>
              <h1 style="font-size: 40px; letter-spacing: 8px; color: #6C3CE1; background: #F0EDFB; padding: 16px 24px; display: inline-block; border-radius: 12px; margin: 0;">
                ${code}
              </h1>
              <p style="color: #9CA3AF; font-size: 13px; margin-top: 16px;">Ce code expire dans 10 minutes.</p>
            </div>
          </div>
        `,
            });
        }
        catch (error) {
            console.error('Erreur envoi email:', error);
        }
    }
    async sendWelcomeEmail(email, name) {
        try {
            await this.transporter.sendMail({
                from: `"Koogwz" <${this.configService.get('GMAIL_USER')}>`,
                to: email,
                subject: 'Bienvenue sur Koogwz !',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #6C3CE1;">Bienvenue, ${name} ! 🎉</h2>
            <p>Votre compte Koogwz est prêt. Vous pouvez maintenant commander votre première course.</p>
          </div>
        `,
            });
        }
        catch (error) {
            console.error('Erreur envoi email welcome:', error);
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], MailService);
//# sourceMappingURL=mail.service.js.map