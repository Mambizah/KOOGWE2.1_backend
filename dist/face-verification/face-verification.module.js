"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaceVerificationModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const face_verification_controller_1 = require("./face-verification.controller");
const face_verification_service_1 = require("./face-verification.service");
const aws_rekognition_service_1 = require("./aws-rekognition.service");
const prisma_service_1 = require("../prisma.service");
let FaceVerificationModule = class FaceVerificationModule {
};
exports.FaceVerificationModule = FaceVerificationModule;
exports.FaceVerificationModule = FaceVerificationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    secret: configService.get('JWT_SECRET'),
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        controllers: [face_verification_controller_1.FaceVerificationController],
        providers: [face_verification_service_1.FaceVerificationService, aws_rekognition_service_1.AWSRekognitionService, prisma_service_1.PrismaService],
        exports: [face_verification_service_1.FaceVerificationService],
    })
], FaceVerificationModule);
//# sourceMappingURL=face-verification.module.js.map