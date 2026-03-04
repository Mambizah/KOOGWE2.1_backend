import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail.service';
import { CreateAuthDto } from './dto/create-auth.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private mailService;
    constructor(prisma: PrismaService, jwtService: JwtService, mailService: MailService);
    create(createAuthDto: CreateAuthDto): Promise<{
        message: string;
        email: string;
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
            accountStatus: import(".prisma/client").$Enums.AccountStatus;
        };
    }>;
    verifyEmail(email: string, _code: string): Promise<{
        message: string;
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
            accountStatus: import(".prisma/client").$Enums.AccountStatus;
        };
    }>;
    resendOtp(_email: string): Promise<{
        message: string;
    }>;
    login(email: string, password: string): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
            accountStatus: import(".prisma/client").$Enums.AccountStatus;
        };
    }>;
    adminLogin(email: string, password: string): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
            accountStatus: import(".prisma/client").$Enums.AccountStatus;
        };
    }>;
}
