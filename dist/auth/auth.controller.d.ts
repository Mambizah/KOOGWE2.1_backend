import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    create(createAuthDto: CreateAuthDto): Promise<{
        message: string;
        email: any;
    }>;
    login(body: {
        email: string;
        password: string;
    }): Promise<{
        access_token: any;
        user: {
            id: any;
            email: any;
            name: any;
            role: any;
            accountStatus: any;
        };
    }>;
    verify(body: {
        email: string;
        code: string;
    }): Promise<{
        message: string;
    }>;
}
