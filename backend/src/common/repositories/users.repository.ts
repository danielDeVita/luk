import { Injectable } from '@nestjs/common';
import { Prisma, User, UserReputation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from './base.repository';

/**
 * Repository for User entity operations.
 * Provides type-safe database operations for users.
 */
@Injectable()
export class UsersRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput,
  Prisma.UserWhereInput,
  Prisma.UserOrderByWithRelationInput,
  Prisma.UserInclude
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.user;
  }

  /**
   * Find a user by email address.
   */
  async findByEmail(
    email: string,
    include?: Prisma.UserInclude,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      ...(include && { include }),
    });
  }

  /**
   * Find a user by Google ID (OAuth).
   */
  async findByGoogleId(
    googleId: string,
    include?: Prisma.UserInclude,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
      ...(include && { include }),
    });
  }

  /**
   * Find a user by seller payment account identifier.
   */
  async findBySellerPaymentAccountId(
    sellerPaymentAccountId: string,
    include?: Prisma.UserInclude,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { sellerPaymentAccountId },
      ...(include && { include }),
    });
  }

  /**
   * Update a user's seller payment account credentials.
   */
  async updateSellerPaymentAccountCredentials(
    userId: string,
    data: {
      sellerPaymentAccountId: string;
      sellerPaymentAccountStatus: 'NOT_CONNECTED' | 'PENDING' | 'CONNECTED';
    },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Disconnect the seller payment account by clearing credentials.
   */
  async disconnectSellerPaymentAccount(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        sellerPaymentAccountId: null,
        sellerPaymentAccountStatus: 'NOT_CONNECTED',
      },
    });
  }

  /**
   * Get user with reputation data.
   */
  async findWithReputation(
    userId: string,
  ): Promise<(User & { reputation: UserReputation | null }) | null> {
    const result = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { reputation: true },
    });
    return result;
  }

  /**
   * Soft delete a user.
   */
  async softDelete(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Find users by role.
   */
  async findByRole(
    role: 'USER' | 'ADMIN' | 'BANNED',
    options?: {
      skip?: number;
      take?: number;
      includeDeleted?: boolean;
    },
  ): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        role,
        isDeleted: options?.includeDeleted ? undefined : false,
      },
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }
}
