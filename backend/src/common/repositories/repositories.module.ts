import { Module, Global } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { RafflesRepository } from './raffles.repository';
import { TicketsRepository } from './tickets.repository';
import { TransactionsRepository } from './transactions.repository';
import { DisputesRepository } from './disputes.repository';

const repositories = [
  UsersRepository,
  RafflesRepository,
  TicketsRepository,
  TransactionsRepository,
  DisputesRepository,
];

/**
 * Global module providing repository classes for all entities.
 *
 * The Repository Pattern provides:
 * - Abstraction over Prisma for better testability
 * - Centralized query logic with reusable methods
 * - Type-safe database operations
 * - Consistent patterns across all entities
 *
 * Import this module once in AppModule to make repositories
 * available throughout the application.
 */
@Global()
@Module({
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
