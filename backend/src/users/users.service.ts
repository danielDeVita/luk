import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, KycStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateKycInput, AcceptTermsInput } from './dto/update-user.input';
import { EncryptionService } from '../common/services/encryption.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
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
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Decrypt PII fields if encryption is enabled
    const decryptedPII = this.encryptionService.decryptUserPII(user);

    return {
      ...user,
      ...decryptedPII,
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

    return this.prisma.user.update({
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
        kycSubmittedAt: new Date(),
      },
    });
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
