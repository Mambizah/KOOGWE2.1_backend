import { PrismaService } from '../prisma.service';
export declare class WalletService {
    private prisma;
    constructor(prisma: PrismaService);
    getBalance(userId: string): Promise<{
        balance: number;
    }>;
    rechargeWithCard(userId: string, amount: number, paymentMethodId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    payRideFromWallet(userId: string, rideId: string, amount: number): Promise<{
        success: boolean;
        message: string;
    }>;
    requestWithdrawal(userId: string, amount: number): Promise<{
        success: boolean;
        message: string;
    }>;
    getTransactionHistory(userId: string): Promise<any>;
}
