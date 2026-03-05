import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé à l’administrateur');
    }
  }

  @Post('upload')
  upload(
    @Request() req: any,
    @Body() body: { type: string; imageBase64: string; userId?: string },
  ) {
    return this.documentsService.uploadBase64Document({
      userId: req.user.sub,
      type: body.type,
      imageBase64: body.imageBase64,
    });
  }

  @Get('admin/pending')
  getPendingDocuments(@Request() req: any) {
    this.assertAdmin(req);
    return this.documentsService.listPendingDocuments();
  }

  @Get('pending')
  getPendingDocumentsAlias(@Request() req: any) {
    this.assertAdmin(req);
    return this.documentsService.listPendingDocuments();
  }

  @Get('admin/list')
  async getPendingDocumentsWrapped(@Request() req: any) {
    this.assertAdmin(req);
    const documents = await this.documentsService.listPendingDocuments();
    return { documents, total: documents.length };
  }

  @Get('admin/approved')
  async getApprovedDocuments(@Request() req: any) {
    this.assertAdmin(req);
    const documents = await this.documentsService.listApprovedDocuments();
    return documents;
  }

  @Get('admin/approved/list')
  async getApprovedDocumentsWrapped(@Request() req: any) {
    this.assertAdmin(req);
    const documents = await this.documentsService.listApprovedDocuments();
    return { documents, total: documents.length };
  }

  @Get('admin/drivers/pending')
  getPendingDrivers(@Request() req: any) {
    this.assertAdmin(req);
    return this.documentsService.listPendingDrivers();
  }

  @Patch('admin/:id/review')
  reviewDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string },
  ) {
    this.assertAdmin(req);
    return this.documentsService.reviewDocument({
      documentId: id,
      adminId: req.user.sub,
      status: body.status,
      rejectionReason: body.rejectionReason,
    });
  }

  @Patch('admin/drivers/:driverId/decision')
  decideDriver(
    @Request() req: any,
    @Param('driverId') driverId: string,
    @Body() body: { approved: boolean; adminNotes?: string },
  ) {
    this.assertAdmin(req);
    return this.documentsService.decideDriverAccount({
      driverId,
      adminId: req.user.sub,
      approved: body.approved,
      adminNotes: body.adminNotes,
    });
  }
}
