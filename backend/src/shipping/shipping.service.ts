import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateShippingAddressInput,
  UpdateShippingAddressInput,
} from './dto/shipping-address.input';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly MAX_ADDRESSES = 5;

  constructor(private prisma: PrismaService) {}

  async create(userId: string, input: CreateShippingAddressInput) {
    // Check address limit
    const count = await this.prisma.shippingAddress.count({
      where: { userId },
    });

    if (count >= this.MAX_ADDRESSES) {
      throw new BadRequestException(
        `Maximo ${this.MAX_ADDRESSES} direcciones permitidas`,
      );
    }

    // If this is the first address or marked as default, handle default logic
    const shouldBeDefault = input.isDefault || count === 0;

    if (shouldBeDefault) {
      await this.prisma.shippingAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.shippingAddress.create({
      data: {
        userId,
        label: input.label ?? 'Principal',
        recipientName: input.recipientName,
        street: input.street,
        number: input.number,
        apartment: input.apartment,
        city: input.city,
        province: input.province,
        postalCode: input.postalCode,
        country: input.country ?? 'Argentina',
        phone: input.phone,
        instructions: input.instructions,
        isDefault: shouldBeDefault,
      },
    });

    this.logger.log(`Shipping address created for user ${userId}`);
    return address;
  }

  async findAll(userId: string) {
    return this.prisma.shippingAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const address = await this.prisma.shippingAddress.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Direccion no encontrada');
    }

    return address;
  }

  async getDefault(userId: string) {
    return this.prisma.shippingAddress.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async update(userId: string, id: string, input: UpdateShippingAddressInput) {
    await this.findOne(userId, id);

    // Handle default logic
    if (input.isDefault) {
      await this.prisma.shippingAddress.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.shippingAddress.update({
      where: { id },
      data: input,
    });

    this.logger.log(`Shipping address ${id} updated`);
    return updated;
  }

  async delete(userId: string, id: string) {
    const address = await this.findOne(userId, id);
    const wasDefault = address.isDefault;

    await this.prisma.shippingAddress.delete({ where: { id } });

    // If deleted was default, make another one default
    if (wasDefault) {
      const first = await this.prisma.shippingAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (first) {
        await this.prisma.shippingAddress.update({
          where: { id: first.id },
          data: { isDefault: true },
        });
      }
    }

    this.logger.log(`Shipping address ${id} deleted`);
    return true;
  }

  async setDefault(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.shippingAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    await this.prisma.shippingAddress.update({
      where: { id },
      data: { isDefault: true },
    });

    this.logger.log(`Shipping address ${id} set as default`);
    return true;
  }
}
