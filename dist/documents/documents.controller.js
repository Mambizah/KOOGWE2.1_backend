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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const documents_service_1 = require("./documents.service");
let DocumentsController = class DocumentsController {
    constructor(documentsService) {
        this.documentsService = documentsService;
    }
    assertAdmin(req) {
        if (req.user?.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Accès réservé à l’administrateur');
        }
    }
    upload(req, body) {
        return this.documentsService.uploadBase64Document({
            userId: req.user.sub,
            type: body.type,
            imageBase64: body.imageBase64,
        });
    }
    getPendingDocuments(req) {
        this.assertAdmin(req);
        return this.documentsService.listPendingDocuments();
    }
    getPendingDrivers(req) {
        this.assertAdmin(req);
        return this.documentsService.listPendingDrivers();
    }
    reviewDocument(req, id, body) {
        this.assertAdmin(req);
        return this.documentsService.reviewDocument({
            documentId: id,
            adminId: req.user.sub,
            status: body.status,
            rejectionReason: body.rejectionReason,
        });
    }
    decideDriver(req, driverId, body) {
        this.assertAdmin(req);
        return this.documentsService.decideDriverAccount({
            driverId,
            adminId: req.user.sub,
            approved: body.approved,
            adminNotes: body.adminNotes,
        });
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Post)('upload'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)('admin/pending'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getPendingDocuments", null);
__decorate([
    (0, common_1.Get)('admin/drivers/pending'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getPendingDrivers", null);
__decorate([
    (0, common_1.Patch)('admin/:id/review'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "reviewDocument", null);
__decorate([
    (0, common_1.Patch)('admin/drivers/:driverId/decision'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('driverId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "decideDriver", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, common_1.Controller)('documents'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [documents_service_1.DocumentsService])
], DocumentsController);
//# sourceMappingURL=documents.controller.js.map