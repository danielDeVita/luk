import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryInput, UpdateCategoryInput } from './dto/create-category.input';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async create(input: CreateCategoryInput) {
    const existing = await this.prisma.category.findUnique({
      where: { nombre: input.nombre },
    });

    if (existing) {
      throw new ConflictException('Ya existe una categoria con ese nombre');
    }

    const category = await this.prisma.category.create({
      data: {
        nombre: input.nombre,
        descripcion: input.descripcion,
        icono: input.icono,
        orden: input.orden ?? 0,
      },
    });

    this.logger.log(`Category created: ${category.nombre}`);
    return category;
  }

  async findAll(includeInactive = false) {
    return this.prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada');
    }

    return category;
  }

  async update(id: string, input: UpdateCategoryInput) {
    await this.findOne(id);

    if (input.nombre) {
      const existing = await this.prisma.category.findFirst({
        where: { nombre: input.nombre, id: { not: id } },
      });

      if (existing) {
        throw new ConflictException('Ya existe una categoria con ese nombre');
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: input,
    });

    this.logger.log(`Category updated: ${updated.nombre}`);
    return updated;
  }

  async delete(id: string) {
    await this.findOne(id);

    // Check if there are raffles using this category
    const rafflesCount = await this.prisma.raffle.count({
      where: { categoryId: id },
    });

    if (rafflesCount > 0) {
      // Soft delete by deactivating
      await this.prisma.category.update({
        where: { id },
        data: { isActive: false },
      });
      this.logger.log(`Category deactivated (has ${rafflesCount} raffles): ${id}`);
    } else {
      await this.prisma.category.delete({ where: { id } });
      this.logger.log(`Category deleted: ${id}`);
    }

    return true;
  }

  async seedDefaultCategories() {
    const defaults = [
      { nombre: 'Electronica', descripcion: 'Celulares, computadoras, gadgets', icono: 'laptop', orden: 1 },
      { nombre: 'Moda', descripcion: 'Ropa, zapatillas, accesorios', icono: 'shirt', orden: 2 },
      { nombre: 'Hogar', descripcion: 'Electrodomesticos, muebles, decoracion', icono: 'home', orden: 3 },
      { nombre: 'Deportes', descripcion: 'Equipamiento deportivo, bicicletas', icono: 'dumbbell', orden: 4 },
      { nombre: 'Vehiculos', descripcion: 'Autos, motos, accesorios', icono: 'car', orden: 5 },
      { nombre: 'Entretenimiento', descripcion: 'Consolas, juegos, instrumentos', icono: 'gamepad', orden: 6 },
      { nombre: 'Otros', descripcion: 'Todo lo demas', icono: 'box', orden: 99 },
    ];

    for (const cat of defaults) {
      await this.prisma.category.upsert({
        where: { nombre: cat.nombre },
        update: {},
        create: cat,
      });
    }

    this.logger.log('Default categories seeded');
  }
}
