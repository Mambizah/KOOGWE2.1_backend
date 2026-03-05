import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
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

  @Get('overview')
  async getOverview(@Request() req: any) {
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

  @Get('documents/approved')
  async getApprovedDocuments(@Request() req: any) {
    this.assertAdmin(req);
    return this.adminService.getApprovedDocuments();
  }

  @Get('approved-documents')
  async getApprovedDocumentsAlias(@Request() req: any) {
    this.assertAdmin(req);
    const documents = await this.adminService.getApprovedDocuments();
    return { documents, total: documents.length };
  }

  @Get('documents/:documentId')
  async getDocumentDetails(@Request() req: any, @Param('documentId') documentId: string) {
    this.assertAdmin(req);
    return this.adminService.getDocumentDetails(documentId);
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
    @Body() body: { status?: DocumentStatus | string; approved?: boolean; rejectionReason?: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.reviewDocument({
      documentId,
      adminId: req.user.sub,
      status: body.status,
      approved: body.approved,
      rejectionReason: body.rejectionReason,
    });
  }

  @Post('documents/:documentId/review')
  async reviewDocumentPost(
    @Request() req: any,
    @Param('documentId') documentId: string,
    @Body() body: { status?: DocumentStatus | string; approved?: boolean; rejectionReason?: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.reviewDocument({
      documentId,
      adminId: req.user.sub,
      status: body.status,
      approved: body.approved,
      rejectionReason: body.rejectionReason,
    });
  }

  @Post('documents/:documentId/approve')
  async approveDocument(@Request() req: any, @Param('documentId') documentId: string) {
    this.assertAdmin(req);
    return this.adminService.reviewDocument({
      documentId,
      adminId: req.user.sub,
      status: 'APPROVED',
    });
  }

  @Post('documents/:documentId/reject')
  async rejectDocument(
    @Request() req: any,
    @Param('documentId') documentId: string,
    @Body() body: { rejectionReason?: string },
  ) {
    this.assertAdmin(req);
    return this.adminService.reviewDocument({
      documentId,
      adminId: req.user.sub,
      status: 'REJECTED',
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
