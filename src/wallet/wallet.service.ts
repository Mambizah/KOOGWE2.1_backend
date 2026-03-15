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
    _paymentMethodId: string,
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

  async recordCashPayment(
    userId: string,
    rideId: string,
    amount: number,
  ): Promise<{ success: boolean; message: string }> {
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
    } catch (error) {
      console.error('Erreur paiement cash:', error);
      return { success: false, message: 'Erreur lors de l’enregistrement cash' };
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
  // BUG FIX 1: méthodes Stripe intent appelées par Flutter wallet_screen
  // Crée un PaymentIntent Stripe et retourne le clientSecret
  async createRechargeIntent(userId: string, amount: number): Promise<{ clientSecret: string; paymentIntentId: string }> {
    // Si Stripe SDK est configuré, utiliser l'API Stripe
    // Sinon, retourner un mock pour le développement
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      // Mode dev: simuler un intent
      const mockId = `pi_mock_${Date.now()}`;
      return { clientSecret: `${mockId}_secret_mock`, paymentIntentId: mockId };
    }
    try {
      const stripe = require('stripe')(stripeSecretKey);
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // centimes
        currency: 'eur',
        metadata: { userId },
      });
      return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
    } catch (e) {
      throw new Error(`Stripe error: ${(e as any).message}`);
    }
  }

  // Confirme le paiement Stripe et crédite le wallet
  async confirmRechargeIntent(paymentIntentId: string): Promise<{ success: boolean; balance: number }> {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    let amount = 0;
    let userId = '';

    if (stripeSecretKey && !paymentIntentId.startsWith('pi_mock_')) {
      try {
        const stripe = require('stripe')(stripeSecretKey);
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== 'succeeded') {
          throw new Error('Paiement non confirmé');
        }
        amount = intent.amount / 100;
        userId = intent.metadata?.userId ?? '';
      } catch (e) {
        throw new Error(`Stripe confirm error: ${(e as any).message}`);
      }
    } else {
      // Mode mock dev — montant fixe 10€
      amount = 10;
      userId = ''; // sera ignoré si vide
    }

    if (userId) {
      const wallet = await this.prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: amount } },
      });
      await this.prisma.transaction.create({
        data: {
          userId,
          type: 'RECHARGE',
          amount,
          status: 'COMPLETED',
          stripePaymentId: paymentIntentId,
        },
      });
      return { success: true, balance: wallet.balance };
    }
    return { success: true, balance: 0 };
  }

}