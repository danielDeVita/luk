import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { ReputationService } from './reputation.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UsersService, UsersResolver, ReputationService],
  exports: [UsersService, ReputationService],
})
export class UsersModule {}
