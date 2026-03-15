import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance/:userId')
  async getBalance(@Param('userId') userId: string) {
    return this.walletService.getBalance(userId);
  }

  @Post('recharge-card')
  async rechargeWithCard(
    @Body() dto: { userId: string; amount: number; paymentMethodId: string },
  ) {
    return this.walletService.rechargeWithCard(dto.userId, dto.amount, dto.paymentMethodId);
  }

  @Post('pay-ride')
  async payRide(@Body() dto: { userId: string; rideId: string; amount: number }) {
    return this.walletService.payRideFromWallet(dto.userId, dto.rideId, dto.amount);
  }

  @Post('record-cash')
  async recordCashPayment(@Body() dto: { userId: string; rideId: string; amount: number }) {
    return this.walletService.recordCashPayment(dto.userId, dto.rideId, dto.amount);
  }

  @Post('request-withdrawal')
  async requestWithdrawal(@Body() dto: { userId: string; amount: number }) {
    return this.walletService.requestWithdrawal(dto.userId, dto.amount);
  }

  @Get('transactions/:userId')
  async getTransactions(@Param('userId') userId: string) {
    return this.walletService.getTransactionHistory(userId);
  }
}
  // BUG FIX 1: endpoints Stripe manquants — Flutter appelle ces routes
  @Post('create-recharge-intent')
  async createRechargeIntent(@Body() dto: { userId: string; amount: number }) {
    return this.walletService.createRechargeIntent(dto.userId, dto.amount);
  }

  @Post('confirm-recharge')
  async confirmRecharge(@Body() dto: { paymentIntentId: string }) {
    return this.walletService.confirmRechargeIntent(dto.paymentIntentId);
  }
