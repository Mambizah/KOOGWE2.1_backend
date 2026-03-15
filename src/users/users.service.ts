import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

export interface UpdateVehicleDto {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateVehicle(userId: string, data: UpdateVehicleDto) {
    const existingProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!existingProfile) throw new NotFoundException("Profil chauffeur introuvable");

    const updatedProfile = await this.prisma.driverProfile.update({
      where: { userId },
      data: {
        vehicleMake: data.vehicleMake,
        vehicleModel: data.vehicleModel,
        vehicleColor: data.vehicleColor,
        licensePlate: data.licensePlate,
      },
    });

    // BUG FIX 2: après le véhicule, le chauffeur doit encore uploader ses docs
    // Donc DOCUMENTS_PENDING (pas ADMIN_REVIEW_PENDING qui saute l'étape documents)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: "DOCUMENTS_PENDING",
      },
    });

    return updatedProfile;
  }

  // ✅ Marquer la vérification faciale comme complète
  async markFaceVerified(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException("Profil chauffeur introuvable");

    return this.prisma.driverProfile.update({
      where: { userId },
      data: { faceVerified: true, faceVerifiedAt: new Date() },
    });
  }

  // ✅ Marquer les documents comme uploadés
  async markDocumentsUploaded(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException("Profil chauffeur introuvable");

    await this.prisma.driverProfile.update({
      where: { userId },
      data: { documentsUploaded: true, documentsUploadedAt: new Date() },
    });

    // BUG FIX: passer à ADMIN_REVIEW_PENDING pour que l'admin voie ce chauffeur
    // C'est ici (submit final des docs) et non dans uploadBase64Document (upload individuel)
    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'ADMIN_REVIEW_PENDING' as any },
    });

    return { success: true, message: "Documents soumis avec succès — en attente de validation" };
  }

  // ✅ Statut global du chauffeur
  async getDriverStatus(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException("Profil chauffeur introuvable");

    return {
      faceVerified: profile.faceVerified,
      documentsUploaded: profile.documentsUploaded,
      adminApproved: profile.adminApproved,
      // Étape courante dans l'onboarding
      currentStep: !profile.faceVerified
        ? "face_verification"
        : (profile.vehicleMake == null || profile.vehicleModel == null || profile.vehicleColor == null || profile.licensePlate == null)
          ? "vehicle_registration"
          : !profile.adminApproved
            ? "pending_admin"
            : "active",
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });
    if (!user) throw new NotFoundException("Utilisateur introuvable");
    const safeUser: any = { ...user };
    delete safeUser.password;
    delete safeUser.verificationToken;
    return safeUser;
  }
}
