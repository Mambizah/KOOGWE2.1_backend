import { PrismaService } from '../prisma.service';
export declare class WalletService {
    private prisma;
    constructor(prisma: PrismaService);
    getBalance(userId: string): Promise<{
        balance: number;
    }>;
    rechargeWithCard(userId: string, amount: number, _paymentMethodId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    payRideFromWallet(userId: string, rideId: string, amount: number): Promise<{
        success: boolean;
        message: string;
    }>;
    recordCashPayment(userId: string, rideId: string, amount: number): Promise<{
        success: boolean;
        message: string;
    }>;
    requestWithdrawal(userId: string, amount: number): Promise<{
        success: boolean;
        message: string;
    }>;
    getTransactionHistory(userId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        type: import(".prisma/client").$Enums.TransactionType;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod | null;
        status: import(".prisma/client").$Enums.TransactionStatus;
        completedAt: Date | null;
        rideId: string | null;
        amount: number;
        stripePaymentId: string | null;
        reference: string | null;
        rejectionReason: string | null;
    }[]>;
}
