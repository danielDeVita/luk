import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(private prisma: PrismaService) {}

  async addFavorite(userId: string, raffleId: string) {
    // Check if raffle exists
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, sellerId: true, isDeleted: true },
    });

    if (!raffle || raffle.isDeleted) {
      throw new NotFoundException('Rifa no encontrada');
    }

    if (raffle.sellerId === userId) {
      throw new BadRequestException(
        'No puedes agregar tu propia rifa a favoritos',
      );
    }

    // Check if already favorited
    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_raffleId: { userId, raffleId },
      },
    });

    if (existing) {
      return existing;
    }

    const favorite = await this.prisma.favorite.create({
      data: { userId, raffleId },
      include: {
        raffle: {
          include: {
            product: true,
            seller: { select: { id: true, nombre: true, apellido: true } },
          },
        },
      },
    });

    this.logger.log(`User ${userId} added raffle ${raffleId} to favorites`);
    return favorite;
  }

  async removeFavorite(userId: string, raffleId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_raffleId: { userId, raffleId },
      },
    });

    if (!existing) {
      throw new NotFoundException('Favorito no encontrado');
    }

    await this.prisma.favorite.delete({
      where: {
        userId_raffleId: { userId, raffleId },
      },
    });

    this.logger.log(`User ${userId} removed raffle ${raffleId} from favorites`);
    return true;
  }

  async getUserFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        raffle: {
          include: {
            product: true,
            seller: { select: { id: true, nombre: true, apellido: true } },
            _count: { select: { tickets: { where: { estado: 'PAGADO' } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isFavorite(userId: string, raffleId: string): Promise<boolean> {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_raffleId: { userId, raffleId },
      },
    });
    return !!favorite;
  }

  async getFavoriteCount(raffleId: string): Promise<number> {
    return this.prisma.favorite.count({
      where: { raffleId },
    });
  }
}
