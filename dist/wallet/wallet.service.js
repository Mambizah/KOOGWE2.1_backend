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
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let WalletService = class WalletService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBalance(userId) {
        const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
        return { balance: wallet?.balance || 0 };
    }
    async rechargeWithCard(userId, amount, _paymentMethodId) {
        try {
            await this.prisma.$transaction([
                this.prisma.wallet.update({
                    where: { userId },
                    data: { balance: { increment: amount } },
                }),
                this.prisma.transaction.create({
                    data: {
                        userId,
                        type: 'RECHARGE',
                        amount,
                        status: 'COMPLETED',
                        paymentMethod: 'CARD',
                        reference: `MANUAL-${Date.now()}`,
                    },
                }),
            ]);
            return { success: true, message: 'Recharge effectuée' };
        }
        catch (error) {
            console.error('Erreur recharge:', error);
            return { success: false, message: 'Erreur lors de la recharge' };
        }
    }
    async payRideFromWallet(userId, rideId, amount) {
        try {
            const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
            if (!wallet || wallet.balance < amount) {
                return { success: false, message: 'Solde insuffisant' };
            }
            const ride = await this.prisma.ride.findUnique({
                where: { id: rideId },
                include: { driver: true },
            });
            if (!ride || !ride.driverId) {
                return { success: false, message: 'Course introuvable' };
            }
            await this.prisma.$transaction([
                this.prisma.wallet.update({
                    where: { userId },
                    data: { balance: { decrement: amount } },
                }),
                this.prisma.wallet.update({
                    where: { userId: ride.driverId },
                    data: { balance: { increment: amount } },
                }),
                this.prisma.transaction.create({
                    data: {
                        userId,
                        type: 'PAYMENT',
                        amount: -amount,
                        status: 'COMPLETED',
                        rideId,
                        paymentMethod: 'WALLET',
                    },
                }),
                this.prisma.transaction.create({
                    data: {
                        userId: ride.driverId,
                        type: 'RECHARGE',
                        amount,
                        status: 'COMPLETED',
                        rideId,
                        paymentMethod: 'WALLET',
                    },
                }),
                this.prisma.ride.update({
                    where: { id: rideId },
                    data: { isPaid: true },
                }),
            ]);
            return { success: true, message: 'Paiement réussi' };
        }
        catch (error) {
            console.error('Erreur paiement wallet:', error);
            return { success: false, message: 'Erreur lors du paiement' };
        }
    }
    async recordCashPayment(userId, rideId, amount) {
        try {
            const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
            if (!ride) {
                return { success: false, message: 'Course introuvable' };
            }
            if (ride.passengerId !== userId) {
                return { success: false, message: 'Utilisateur non autorisé' };
            }
            await this.prisma.$transaction([
                this.prisma.transaction.create({
                    data: {
                        userId,
                        type: 'PAYMENT',
                        amount: -amount,
                        status: 'COMPLETED',
                        rideId,
                        paymentMethod: 'CASH',
                    },
                }),
                ...(ride.driverId
                    ? [
                        this.prisma.transaction.create({
                            data: {
                                userId: ride.driverId,
                                type: 'RECHARGE',
                                amount,
                                status: 'COMPLETED',
                                rideId,
                                paymentMethod: 'CASH',
                            },
                        }),
                    ]
                    : []),
                this.prisma.ride.update({
                    where: { id: rideId },
                    data: { isPaid: true, paymentMethod: 'CASH' },
                }),
            ]);
            return { success: true, message: 'Paiement cash enregistré' };
        }
        catch (error) {
            console.error('Erreur paiement cash:', error);
            return { success: false, message: 'Erreur lors de l’enregistrement cash' };
        }
    }
    async requestWithdrawal(userId, amount) {
        try {
            const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
            if (!wallet || wallet.balance < amount) {
                return { success: false, message: 'Solde insuffisant' };
            }
            await this.prisma.$transaction([
                this.prisma.transaction.create({
                    data: {
                        userId,
                        type: 'WITHDRAWAL',
                        amount: -amount,
                        status: 'PENDING',
                        paymentMethod: 'CARD',
                    },
                }),
                this.prisma.wallet.update({
                    where: { userId },
                    data: { balance: { decrement: amount } },
                }),
            ]);
            return { success: true, message: 'Demande de retrait envoyée' };
        }
        catch (error) {
            console.error('Erreur retrait:', error);
            return { success: false, message: 'Erreur lors du retrait' };
        }
    }
    async getTransactionHistory(userId) {
        return this.prisma.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map