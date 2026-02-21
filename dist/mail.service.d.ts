import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private configService;
    private transporter;
    constructor(configService: ConfigService);
    sendVerificationCode(email: string, code: string): Promise<void>;
    sendWelcomeEmail(email: string, name: string): Promise<void>;
}
