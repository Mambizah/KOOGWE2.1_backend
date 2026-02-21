import { EmailVerificationService } from './email-verification.service';
declare class SendCodeDto {
    email: string;
    name?: string;
}
declare class VerifyCodeDto {
    email: string;
    code: string;
}
export declare class EmailVerificationController {
    private emailVerificationService;
    constructor(emailVerificationService: EmailVerificationService);
    sendCode(dto: SendCodeDto): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyCode(dto: VerifyCodeDto): Promise<{
        success: boolean;
        message: string;
    }>;
    resendCode(dto: {
        email: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
}
export {};
