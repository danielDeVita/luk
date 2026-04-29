import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UserRole,
  KycStatus,
  SellerPaymentAccountStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  UpdateKycInput,
  AcceptTermsInput,
  CreateSellerReviewInput,
  UpsertSellerPaymentAccountInput,
} from './dto/update-user.input';
import { EncryptionService } from '../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReputationService } from './reputation.service';
import { PublicSellerReview } from './entities/review.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private notificationsService: NotificationsService,
    private reputationService: ReputationService,
  ) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, isDeleted: false },
      include: {
        rafflesCreated: { include: { product: true } },
        ticketsPurchased: { include: { raffle: true } },
        reputation: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async getUserWithDecryptedPII(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sellerPaymentAccount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Decrypt PII fields if encryption is enabled
    const decryptedPII = this.encryptionService.decryptUserPII(user);

    return {
      ...user,
      ...decryptedPII,
      sellerPaymentAccount: user.sellerPaymentAccount
        ? {
            ...user.sellerPaymentAccount,
            maskedAccountIdentifier: user.sellerPaymentAccount
              .accountIdentifierEncrypted
              ? this.encryptionService.mask(
                  this.encryptionService.decrypt(
                    user.sellerPaymentAccount.accountIdentifierEncrypted,
                  ),
                )
              : null,
          }
        : null,
    };
  }

  async updateProfile(
    userId: string,
    data: { nombre?: string; apellido?: string; phone?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async updateKyc(userId: string, input: UpdateKycInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // If already verified, don't allow changes
    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException(
        'KYC ya verificado. Contacte soporte para cambios.',
      );
    }

    // Encrypt sensitive PII fields
    const encryptedData = this.encryptionService.encryptUserPII({
      documentNumber: input.documentNumber,
      cuitCuil: input.cuitCuil,
      street: input.street,
      streetNumber: input.streetNumber,
      apartment: input.apartment,
      city: input.city,
      province: input.province,
      postalCode: input.postalCode,
      phone: input.phone,
    });

    const submittedAt = new Date();

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        documentType: input.documentType,
        documentNumber: encryptedData.documentNumber,
        documentFrontUrl: input.documentFrontUrl,
        documentBackUrl: input.documentBackUrl,
        street: encryptedData.street,
        streetNumber: encryptedData.streetNumber,
        apartment: encryptedData.apartment,
        city: encryptedData.city,
        province: encryptedData.province,
        postalCode: encryptedData.postalCode,
        phone: encryptedData.phone,
        cuitCuil: encryptedData.cuitCuil,
        kycStatus: KycStatus.PENDING_REVIEW,
        kycSubmittedAt: submittedAt,
      },
    });

    // Notify all admins about new KYC submission
    this.notifyAdminsAboutNewKyc(user, submittedAt).catch((error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to notify admins about KYC: ${errorMsg}`);
    });

    return updatedUser;
  }

  /**
   * Notifies all admin users about a new KYC submission
   */
  private async notifyAdminsAboutNewKyc(
    user: { id: string; nombre: string; apellido: string; email: string },
    submittedAt: Date,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isDeleted: false },
      select: { id: true, email: true },
    });

    const userName = `${user.nombre} ${user.apellido}`;

    for (const admin of admins) {
      // Send email notification
      await this.notificationsService.sendAdminNewKycSubmission(admin.email, {
        userName,
        userEmail: user.email,
        submittedAt,
      });

      // Create in-app notification
      await this.notificationsService.create(
        admin.id,
        'SYSTEM',
        'Nueva solicitud de KYC',
        `${userName} (${user.email}) envió su documentación de KYC para revisión.`,
      );
    }
  }

  async acceptTerms(userId: string, input: AcceptTermsInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        termsAcceptedAt: new Date(),
        termsVersion: input.termsVersion,
      },
    });
  }

  private computeSellerPaymentAccountStatus(user: {
    kycStatus: KycStatus;
    cuitCuil?: string | null;
    defaultSenderAddressId?: string | null;
    shippingAddresses?: Array<{ id: string }> | null;
    sellerPaymentAccount?: {
      accountHolderName?: string | null;
      accountIdentifierEncrypted?: string | null;
    } | null;
  }): SellerPaymentAccountStatus {
    if (!user.sellerPaymentAccount) {
      return SellerPaymentAccountStatus.NOT_CONNECTED;
    }

    const hasAddress =
      Boolean(user.defaultSenderAddressId) ||
      Boolean(user.shippingAddresses && user.shippingAddresses.length > 0);
    const hasCuit = Boolean(user.cuitCuil);
    const kycVerified = user.kycStatus === KycStatus.VERIFIED;
    const hasPayoutData = Boolean(
      user.sellerPaymentAccount.accountHolderName &&
      user.sellerPaymentAccount.accountIdentifierEncrypted,
    );

    return hasAddress && hasCuit && kycVerified && hasPayoutData
      ? SellerPaymentAccountStatus.CONNECTED
      : SellerPaymentAccountStatus.PENDING;
  }

  async upsertSellerPaymentAccount(
    userId: string,
    input: UpsertSellerPaymentAccountInput,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        cuitCuil: true,
        defaultSenderAddressId: true,
        shippingAddresses: {
          take: 1,
          select: { id: true },
        },
        sellerPaymentAccount: {
          select: {
            id: true,
            accountHolderName: true,
            accountIdentifierEncrypted: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalizedAccountIdentifier = input.accountIdentifier.trim();
    if (!normalizedAccountIdentifier) {
      throw new BadRequestException(
        'Debes ingresar un identificador de cuenta válido',
      );
    }

    const encryptedAccountIdentifier = this.encryptionService.encrypt(
      normalizedAccountIdentifier,
    );
    const status = this.computeSellerPaymentAccountStatus({
      ...user,
      sellerPaymentAccount: {
        accountHolderName: input.accountHolderName.trim(),
        accountIdentifierEncrypted: encryptedAccountIdentifier,
      },
    });

    const account = await this.prisma.sellerPaymentAccount.upsert({
      where: { userId },
      create: {
        userId,
        status,
        accountHolderName: input.accountHolderName.trim(),
        accountIdentifierType: input.accountIdentifierType,
        accountIdentifierEncrypted: encryptedAccountIdentifier,
        providerMetadata: {
          onboardingSource: 'settings_form',
        },
      },
      update: {
        status,
        accountHolderName: input.accountHolderName.trim(),
        accountIdentifierType: input.accountIdentifierType,
        accountIdentifierEncrypted: encryptedAccountIdentifier,
        lastSyncedAt: null,
      },
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        sellerPaymentAccountStatus: status,
        sellerPaymentAccountId: account.id,
      },
      include: {
        sellerPaymentAccount: true,
      },
    });
  }

  async disconnectSellerPaymentAccount(userId: string) {
    await this.prisma.sellerPaymentAccount.deleteMany({
      where: { userId },
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        sellerPaymentAccountStatus: SellerPaymentAccountStatus.NOT_CONNECTED,
        sellerPaymentAccountId: null,
      },
      include: {
        sellerPaymentAccount: true,
      },
    });
  }

  // Role is now singular, not an array
  // Users can both buy and sell, the role just indicates admin/banned status
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === UserRole.ADMIN;
  }

  async getUserStats(userId: string) {
    const [rafflesCreated, ticketsPurchased, rafflesWon] = await Promise.all([
      this.prisma.raffle.count({ where: { sellerId: userId } }),
      this.prisma.ticket.count({
        where: { buyerId: userId, estado: 'PAGADO' },
      }),
      this.prisma.raffle.count({ where: { winnerId: userId } }),
    ]);

    return { rafflesCreated, ticketsPurchased, rafflesWon };
  }

  async softDelete(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async banUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.BANNED },
    });
  }

  async unbanUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.USER },
    });
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new NotFoundException(
        'Usuario no encontrado o sin contraseña configurada (OAuth)',
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('La contraseña actual es incorrecta');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
  }

  async getSellerProfile(sellerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: sellerId },
      include: {
        rafflesCreated: {
          where: { isHidden: false }, // Only show public raffles
          include: { product: true },
          orderBy: { createdAt: 'desc' },
        },
        reputation: true,
        reviewsReceived: {
          where: { commentHidden: false },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            reviewer: { select: { nombre: true, apellido: true } },
            raffle: { select: { titulo: true } },
          },
        },
        _count: { select: { reviewsReceived: true } },
      },
    });

    if (!user) throw new NotFoundException('Vendedor no encontrado');

    // Ensure reputation exists (lazy init for existing users)
    let reputation = user.reputation;
    if (!reputation) {
      reputation = await this.ensureReputation(user.id);
    }

    return {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      createdAt: user.createdAt,
      raffles: user.rafflesCreated,
      reputation: Number(reputation.ratingPromedioVendedor) || null,
      totalVentas: reputation.totalVentasCompletadas,
      nivelVendedor: reputation.nivelVendedor,
      isVerified: user.kycStatus === 'VERIFIED',
      reviewCount: user._count.reviewsReceived,
      reviews: user.reviewsReceived.map((review) =>
        this.toPublicSellerReview(review),
      ),
    };
  }

  async createSellerReview(
    reviewerId: string,
    input: CreateSellerReviewInput,
  ): Promise<PublicSellerReview> {
    if (
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    ) {
      throw new BadRequestException('El puntaje debe estar entre 1 y 5');
    }

    const comentario = input.comentario?.trim() || null;
    if (comentario && comentario.length > 1000) {
      throw new BadRequestException(
        'El comentario no puede superar 1000 caracteres',
      );
    }

    const raffle = await this.prisma.raffle.findUnique({
      where: { id: input.raffleId },
      include: {
        review: true,
        seller: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
      },
    });

    if (!raffle) {
      throw new NotFoundException('Rifa no encontrada');
    }

    if (raffle.winnerId !== reviewerId) {
      throw new ForbiddenException('Solo el ganador puede reseñar al vendedor');
    }

    if (raffle.deliveryStatus !== 'CONFIRMED') {
      throw new BadRequestException(
        'Solo podés dejar una reseña después de confirmar la entrega',
      );
    }

    if (raffle.review) {
      throw new BadRequestException('Ya dejaste una reseña para esta rifa');
    }

    const review = await this.prisma.review.create({
      data: {
        raffleId: raffle.id,
        reviewerId,
        sellerId: raffle.sellerId,
        rating: input.rating,
        comentario,
      },
      include: {
        reviewer: { select: { nombre: true, apellido: true } },
        raffle: { select: { titulo: true } },
      },
    });

    await this.reputationService.recalculateSellerReputation(raffle.sellerId);

    this.notifySellerAboutReview(raffle.seller, review).catch(
      (error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to notify seller about review: ${message}`);
      },
    );

    return this.toPublicSellerReview(review);
  }

  private async notifySellerAboutReview(
    seller: { id: string; email: string; nombre: string; apellido: string },
    review: {
      rating: number;
      comentario: string | null;
      reviewer: { nombre: string; apellido: string };
      raffle: { titulo: string };
    },
  ) {
    const sellerName = [seller.nombre, seller.apellido]
      .filter(Boolean)
      .join(' ');
    const reviewerName = [review.reviewer.nombre, review.reviewer.apellido]
      .filter(Boolean)
      .join(' ');

    await Promise.all([
      this.notificationsService.sendSellerReviewReceivedNotification(
        seller.email,
        {
          sellerName,
          sellerId: seller.id,
          reviewerName,
          raffleName: review.raffle.titulo,
          rating: review.rating,
          comentario: review.comentario,
        },
      ),
      this.notificationsService.create(
        seller.id,
        'INFO',
        'Nueva reseña recibida',
        `${reviewerName} dejó una reseña de ${review.rating}/5 para "${review.raffle.titulo}".`,
        `/seller/${seller.id}`,
      ),
    ]);
  }

  private toPublicSellerReview(review: {
    id: string;
    rating: number;
    comentario: string | null;
    createdAt: Date;
    reviewer: { nombre: string; apellido: string };
    raffle: { titulo: string };
  }): PublicSellerReview {
    return {
      id: review.id,
      rating: review.rating,
      comentario: review.comentario,
      createdAt: review.createdAt,
      reviewerName: [review.reviewer.nombre, review.reviewer.apellido]
        .filter(Boolean)
        .join(' '),
      raffleTitle: review.raffle.titulo,
    };
  }

  async ensureReputation(userId: string) {
    const existing = await this.prisma.userReputation.findUnique({
      where: { userId },
    });

    if (existing) return existing;

    return this.prisma.userReputation.create({
      data: { userId },
    });
  }

  /**
   * Update user's avatar URL.
   * Called after successful Cloudinary upload from frontend.
   */
  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  }

  /**
   * Delete user's avatar (set to null).
   */
  async deleteAvatar(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
  }
}
