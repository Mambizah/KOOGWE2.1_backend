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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let MailService = class MailService {
    constructor(configService) {
        this.configService = configService;
    }
    async sendVerificationCode(email, code) {
        console.log(`📧 [EMAIL DÉSACTIVÉ] Code OTP: ${code} pour: ${email}`);
    }
    async sendWelcomeEmail(email, name) {
        console.log(`📧 [EMAIL DÉSACTIVÉ] Bienvenue ${name} (${email})`);
    }
    async sendRideValidationEmail(email, payload) {
        console.log(`📧 [EMAIL DÉSACTIVÉ] Validation course ${payload.rideId} (${payload.vehicleType}) ${payload.price}€ -> ${email}`);
    }
    async sendDriverAssignedEmail(email, payload) {
        console.log(`📧 [EMAIL DÉSACTIVÉ] Chauffeur assigné course ${payload.rideId}: ${payload.driverName} (${payload.driverPhone ?? 'N/A'}) -> ${email}`);
    }
    async sendRideCancelledEmail(email, payload) {
        console.log(`📧 [EMAIL DÉSACTIVÉ] Course annulée ${payload.rideId} -> ${email}`);
    }
    async sendRideCompletedEmail(email, payload) {
        console.log(`📧 [EMAIL DÉSACTIVÉ] Course terminée ${payload.rideId}, reçu ${payload.price}€ -> ${email}`);
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map