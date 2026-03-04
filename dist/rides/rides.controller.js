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
exports.RidesController = void 0;
const common_1 = require("@nestjs/common");
const rides_service_1 = require("./rides.service");
const auth_guard_1 = require("../auth/auth.guard");
let RidesController = class RidesController {
    constructor(ridesService) {
        this.ridesService = ridesService;
    }
    create(dto, req) {
        return this.ridesService.create(dto, req.user.sub);
    }
    getHistory(req) {
        return this.ridesService.getHistory(req.user.sub, req.user.role);
    }
    getDriverStats(req) {
        return this.ridesService.getDriverStats(req.user.sub);
    }
    getActiveCourses() {
        return this.ridesService.getActiveCourses();
    }
    estimatePrice(dto) {
        return this.ridesService.estimatePrice(dto);
    }
    acceptRide(id, req) {
        return this.ridesService.acceptRide(id, req.user.sub);
    }
    updateStatus(id, dto, req) {
        return this.ridesService.updateStatus(id, req.user.sub, dto.status);
    }
    createScheduled(dto, req) {
        return this.ridesService.createScheduledRide(req.user.sub, dto);
    }
    generateShare(id, req) {
        return this.ridesService.generateShareToken(id, req.user.sub);
    }
    triggerPanic(dto, req) {
        return this.ridesService.triggerPanic(req.user.sub, dto.rideId ?? null, dto.lat, dto.lng);
    }
    addFavorite(dto, req) {
        return this.ridesService.addFavoriteDriver(req.user.sub, dto.driverId);
    }
    removeFavorite(dto, req) {
        return this.ridesService.removeFavoriteDriver(req.user.sub, dto.driverId);
    }
    getFavorites(req) {
        return this.ridesService.getFavoriteDrivers(req.user.sub);
    }
    trackByToken(token) {
        return this.ridesService.getRideByShareToken(token);
    }
    cancelRide(id, req) {
        return this.ridesService.cancelRide(id, req.user.sub, req.user.role);
    }
    rateRide(id, dto, req) {
        return this.ridesService.rateRide(id, req.user.sub, req.user.role, dto.rating, dto.comment);
    }
};
exports.RidesController = RidesController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)('driver/stats'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "getDriverStats", null);
__decorate([
    (0, common_1.Get)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "getActiveCourses", null);
__decorate([
    (0, common_1.Post)('estimate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "estimatePrice", null);
__decorate([
    (0, common_1.Post)(':id/accept'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "acceptRide", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)('scheduled'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "createScheduled", null);
__decorate([
    (0, common_1.Post)(':id/share'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "generateShare", null);
__decorate([
    (0, common_1.Post)('panic'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "triggerPanic", null);
__decorate([
    (0, common_1.Post)('favorites/add'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "addFavorite", null);
__decorate([
    (0, common_1.Post)('favorites/remove'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "removeFavorite", null);
__decorate([
    (0, common_1.Get)('favorites'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "getFavorites", null);
__decorate([
    (0, common_1.Get)('track/:token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "trackByToken", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "cancelRide", null);
__decorate([
    (0, common_1.Post)(':id/rate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], RidesController.prototype, "rateRide", null);
exports.RidesController = RidesController = __decorate([
    (0, common_1.Controller)('rides'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [rides_service_1.RidesService])
], RidesController);
//# sourceMappingURL=rides.controller.js.map