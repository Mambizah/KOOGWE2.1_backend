import { Body, Controller, ForbiddenException, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé à l’administrateur');
    }
  }

  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getDashboardSummary();
  }

  @Get('drivers/pending')
  async getPendingDrivers(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getPendingDrivers();
  }

  @Get('documents/pending')
  async getPendingDocuments(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getPendingDocuments();
  }

  @Get('documents')
  async getPendingDocumentsFlat(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getPendingDocuments();
  }

  @Get('documents/list')
  async getPendingDocumentsList(@Request() req: any) {
    this.assertAdmin(req);
    const documents = await this.adminService.getPendingDocuments();
    return { documents, total: documents.length };
  }

  @Get('pending-documents')
  async getPendingDocumentsAlias(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getPendingDocuments();
  }

  @Patch('documents/:documentId/review')
  async reviewDocument(
    @Request() req: any,
    @Param('documentId') documentId: string,
    @Body() body: { status: DocumentStatus; rejectionReason?: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.reviewDocument({
      documentId,
      adminId: req.user.sub,
      status: body.status,
      rejectionReason: body.rejectionReason,
    });
  }

  @Patch('drivers/:driverId/approval')
  async setDriverApproval(
    @Request() req: any,
    @Param('driverId') driverId: string,
    @Body() body: { approved: boolean; adminNotes?: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.setDriverApproval({
      driverId,
      approved: body.approved,
      adminNotes: body.adminNotes,
    });
  }

  @Get('activity/logins')
  async getLoginActivity(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getLoginActivity();
  }

  @Get('activity/connections')
  async getConnectionsActivity(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getLoginActivity();
  }

  @Get('login-activity')
  async getLoginActivityAlias(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getLoginActivity();
  }
}
