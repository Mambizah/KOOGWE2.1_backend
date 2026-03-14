// REMPLACEZ src/admin/admin.controller.ts
import {
  Body, Controller, ForbiddenException, Get,
  Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== 'ADMIN')
      throw new ForbiddenException("Accès réservé à l'administrateur");
  }

  // Dashboard
  @Get('dashboard') async getDashboard(@Request() req: any) { this.assertAdmin(req); return this.adminService.getDashboardSummary(); }
  @Get('overview') async getOverview(@Request() req: any) { this.assertAdmin(req); return this.adminService.getDashboardSummary(); }
  @Get('dashboard/stats') async getDashboardStats(@Request() req: any) { this.assertAdmin(req); return this.adminService.getDashboardStats(); }
  @Get('dashboard/rides/recent') async getRecentRides(@Request() req: any) { this.assertAdmin(req); return this.adminService.getRecentRides(); }
  @Get('dashboard/documents/pending') async getDashboardPendingDocs(@Request() req: any) { this.assertAdmin(req); return this.adminService.getPendingDocuments(); }

  // Chauffeurs
  @Get('drivers/pending') async getPendingDrivers(@Request() req: any) { this.assertAdmin(req); return this.adminService.getPendingDrivers(); }
  @Get('drivers') async getDrivers(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) { this.assertAdmin(req); return this.adminService.getDrivers(Number(page||1), Number(limit||50)); }
  @Patch('drivers/:id/suspend') async suspendDriver(@Request() req: any, @Param('id') id: string) { this.assertAdmin(req); return this.adminService.setUserStatus(id, 'SUSPENDED'); }
  @Patch('drivers/:id/activate') async activateDriver(@Request() req: any, @Param('id') id: string) { this.assertAdmin(req); return this.adminService.setUserStatus(id, 'ACTIVE'); }
  @Patch('drivers/:driverId/approval') async setDriverApproval(@Request() req: any, @Param('driverId') driverId: string, @Body() body: { approved: boolean; adminNotes?: string }) { this.assertAdmin(req); return this.adminService.setDriverApproval({ driverId, approved: body.approved, adminNotes: body.adminNotes }); }

  // Passagers
  @Get('passengers') async getPassengers(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) { this.assertAdmin(req); return this.adminService.getPassengers(Number(page||1), Number(limit||50)); }
  @Patch('passengers/:id/suspend') async suspendPassenger(@Request() req: any, @Param('id') id: string) { this.assertAdmin(req); return this.adminService.setUserStatus(id, 'SUSPENDED'); }
  @Patch('passengers/:id/activate') async activatePassenger(@Request() req: any, @Param('id') id: string) { this.assertAdmin(req); return this.adminService.setUserStatus(id, 'ACTIVE'); }

  // Documents
  @Get('documents/pending') async getPendingDocuments(@Request() req: any) { this.assertAdmin(req); return this.adminService.getPendingDocuments(); }
  @Get('documents') async getDocuments(@Request() req: any, @Query('status') status?: string) { this.assertAdmin(req); return this.adminService.getDocumentsByStatus(status); }
  @Get('documents/approved') async getApprovedDocuments(@Request() req: any) { this.assertAdmin(req); return this.adminService.getApprovedDocuments(); }
  @Get('approved-documents') async getApprovedDocumentsAlias(@Request() req: any) { this.assertAdmin(req); const d = await this.adminService.getApprovedDocuments(); return { documents: d, total: d.length }; }
  @Get('pending-documents') async getPendingDocumentsAlias(@Request() req: any) { this.assertAdmin(req); return this.adminService.getPendingDocuments(); }
  @Get('documents/:documentId') async getDocumentDetails(@Request() req: any, @Param('documentId') documentId: string) { this.assertAdmin(req); return this.adminService.getDocumentDetails(documentId); }
  @Patch('documents/:documentId/approve') async approveDocPatch(@Request() req: any, @Param('documentId') documentId: string) { this.assertAdmin(req); return this.adminService.reviewDocument({ documentId, adminId: req.user.sub, status: 'APPROVED' }); }
  @Patch('documents/:documentId/reject') async rejectDocPatch(@Request() req: any, @Param('documentId') documentId: string, @Body() body: any) { this.assertAdmin(req); return this.adminService.reviewDocument({ documentId, adminId: req.user.sub, status: 'REJECTED', rejectionReason: body.reason || body.rejectionReason }); }
  @Post('documents/:documentId/approve') async approveDocPost(@Request() req: any, @Param('documentId') documentId: string) { this.assertAdmin(req); return this.adminService.reviewDocument({ documentId, adminId: req.user.sub, status: 'APPROVED' }); }
  @Post('documents/:documentId/reject') async rejectDocPost(@Request() req: any, @Param('documentId') documentId: string, @Body() body: any) { this.assertAdmin(req); return this.adminService.reviewDocument({ documentId, adminId: req.user.sub, status: 'REJECTED', rejectionReason: body.reason || body.rejectionReason }); }
  @Patch('documents/:documentId/review') async reviewDoc(@Request() req: any, @Param('documentId') documentId: string, @Body() body: any) { this.assertAdmin(req); return this.adminService.reviewDocument({ documentId, adminId: req.user.sub, status: body.status, approved: body.approved, rejectionReason: body.rejectionReason }); }
  @Post('documents/:documentId/review') async reviewDocPost(@Request() req: any, @Param('documentId') documentId: string, @Body() body: any) { this.assertAdmin(req); return this.adminService.reviewDocument({ documentId, adminId: req.user.sub, status: body.status, approved: body.approved, rejectionReason: body.rejectionReason }); }

  // Courses
  @Get('rides') async getRides(@Request() req: any, @Query('limit') limit?: string) { this.assertAdmin(req); return this.adminService.getRides(Number(limit||50)); }
  @Get('rides/active') async getActiveRides(@Request() req: any) { this.assertAdmin(req); return this.adminService.getActiveRides(); }

  // Finances
  @Get('finance/stats') async getFinanceStats(@Request() req: any) { this.assertAdmin(req); return this.adminService.getFinanceStats(); }
  @Get('finance/chart') async getFinanceChart(@Request() req: any, @Query('period') period?: string) { this.assertAdmin(req); return this.adminService.getFinanceChart(period||'weekly'); }
  @Get('finance/transactions') async getFinanceTx(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) { this.assertAdmin(req); return this.adminService.getFinanceTransactions(Number(page||1), Number(limit||20)); }

  // Panics
  @Get('panics') async getAllPanics(@Request() req: any) { this.assertAdmin(req); return this.adminService.getActivePanics(); }
  @Get('panics/active') async getActivePanics(@Request() req: any) { this.assertAdmin(req); return this.adminService.getActivePanics(); }

  // Config
  @Get('config') async getConfig(@Request() req: any) { this.assertAdmin(req); return this.adminService.getConfig(); }
  @Patch('config') async updateConfig(@Request() req: any, @Body() body: any) { this.assertAdmin(req); return this.adminService.updateConfig(body); }
  @Get('config/pricing') async getPricing(@Request() req: any) { this.assertAdmin(req); return this.adminService.getPricingConfig(); }
  @Patch('config/pricing') async updatePricing(@Request() req: any, @Body() body: any) { this.assertAdmin(req); return this.adminService.updatePricingConfig(body); }
  @Get('config/financials') async getFinancials(@Request() req: any) { this.assertAdmin(req); return this.adminService.getFinancialsConfig(); }
  @Patch('config/financials') async updateFinancials(@Request() req: any, @Body() body: any) { this.assertAdmin(req); return this.adminService.updateFinancialsConfig(body); }
  @Get('config/security') async getSecurity() { return { maxLoginAttempts: 5, sessionTimeout: 3600 }; }
  @Patch('config/security') async updateSecurity(@Body() body: any) { return { success: true, data: body }; }
  @Get('config/payments') async getPayments() { return { stripeEnabled: false, cashEnabled: true }; }
  @Patch('config/payments') async updatePayments(@Body() body: any) { return { success: true, data: body }; }

  // Activité
  @Get('activity/logins') async getLoginActivity(@Request() req: any) { this.assertAdmin(req); return this.adminService.getLoginActivity(); }
  @Get('activity/connections') async getConnections(@Request() req: any) { this.assertAdmin(req); return this.adminService.getLoginActivity(); }
  @Get('login-activity') async getLoginActivityAlias(@Request() req: any) { this.assertAdmin(req); return this.adminService.getLoginActivity(); }
  @Get('ws') async wsHealth() { return { ok: true }; }
}