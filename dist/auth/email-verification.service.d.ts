import { PrismaService } from '../prisma.service';
export declare class EmailVerificationService {
    private prisma;
    private transporter;
    constructor(prisma: PrismaService);
    generateVerificationCode(): string;
    sendVerificationCode(email: string, name?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyCode(email: string, code: string): Promise<{
        success: boolean;
        message: string;
    }>;
    resendCode(email: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
