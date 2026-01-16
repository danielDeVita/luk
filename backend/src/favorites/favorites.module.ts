import { Module } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesResolver } from './favorites.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [FavoritesService, FavoritesResolver],
  exports: [FavoritesService],
})
export class FavoritesModule {}
