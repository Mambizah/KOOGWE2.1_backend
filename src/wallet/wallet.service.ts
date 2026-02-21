import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  // Obtenir le solde
  async getBalance(userId: string): Promise<{ balance: number }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return { balance: wallet?.balance || 0 };
  }

  // Recharge manuelle (sans Stripe) — l'admin crédite le compte
  async rechargeWithCard(
    userId: string,
    amount: number,
    paymentMethodId: string,
  ): Promise<{ success: boolean; message: string }> {
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
    } catch (error) {
      console.error('Erreur recharge:', error);
      return { success: false, message: 'Erreur lors de la recharge' };
    }
  }

  // Payer une course avec le wallet
  async payRideFromWallet(
    userId: string,
    rideId: string,
    amount: number,
  ): Promise<{ success: boolean; message: string }> {
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
    } catch (error) {
      console.error('Erreur paiement wallet:', error);
      return { success: false, message: 'Erreur lors du paiement' };
    }
  }

  // Demande de retrait (enregistrée en PENDING, traitée manuellement)
  async requestWithdrawal(
    userId: string,
    amount: number,
  ): Promise<{ success: boolean; message: string }> {
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
    } catch (error) {
      console.error('Erreur retrait:', error);
      return { success: false, message: 'Erreur lors du retrait' };
    }
  }

  // Historique des transactions
  async getTransactionHistory(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}