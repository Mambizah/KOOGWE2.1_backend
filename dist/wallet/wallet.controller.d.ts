import { WalletService } from './wallet.service';
export declare class WalletController {
    private walletService;
    constructor(walletService: WalletService);
    getBalance(userId: string): Promise<{
        balance: number;
    }>;
    rechargeWithCard(dto: {
        userId: string;
        amount: number;
        paymentMethodId: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    payRide(dto: {
        userId: string;
        rideId: string;
        amount: number;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    recordCashPayment(dto: {
        userId: string;
        rideId: string;
        amount: number;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    requestWithdrawal(dto: {
        userId: string;
        amount: number;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    getTransactions(userId: string): Promise<{
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
