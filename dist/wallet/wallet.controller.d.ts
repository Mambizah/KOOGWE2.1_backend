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
    requestWithdrawal(dto: {
        userId: string;
        amount: number;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    getTransactions(userId: string): Promise<any>;
}
