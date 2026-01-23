/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
// Disabled because PrismaDelegate uses 'any' to support all Prisma model types generically.
// The actual type safety is provided by the generic parameters of BaseRepository.

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Pagination options for repository queries.
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
}

/**
 * Paginated result with metadata.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Generic type for Prisma model delegates.
 * This allows us to work with any Prisma model generically.
 *
 * We use a minimal interface that's compatible with all Prisma delegates.
 * The 'any' types are necessary because Prisma's generated types vary by model.
 */
interface PrismaDelegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findUnique: (args: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findFirst: (args: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany: (args: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (args: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (args: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: (args: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count: (args: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsert: (args: any) => any;
}

/**
 * Abstract base repository providing common CRUD operations.
 *
 * Benefits:
 * - Centralizes query logic
 * - Easier to test (mock repository instead of Prisma)
 * - Consistent patterns across all entities
 * - Type-safe operations
 *
 * @template T - The entity type returned by queries
 * @template CreateInput - The input type for create operations
 * @template UpdateInput - The input type for update operations
 * @template WhereInput - The where clause type for filtering
 * @template OrderByInput - The order by type for sorting
 * @template IncludeInput - The include type for relations
 */
export abstract class BaseRepository<
  T,
  CreateInput extends object = object,
  UpdateInput extends object = object,
  WhereInput extends object = object,
  OrderByInput extends object = object,
  IncludeInput extends object = object,
> {
  protected abstract get delegate(): PrismaDelegate;

  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Find a single record by its ID.
   *
   * @param id - The record ID
   * @param include - Optional relations to include
   * @returns The record or null if not found
   */
  async findById(id: string, include?: IncludeInput): Promise<T | null> {
    return this.delegate.findUnique({
      where: { id },
      ...(include && { include }),
    });
  }

  /**
   * Find a single record matching the criteria.
   *
   * @param where - Filter conditions
   * @param include - Optional relations to include
   * @returns The first matching record or null
   */
  async findOne(where: WhereInput, include?: IncludeInput): Promise<T | null> {
    return this.delegate.findFirst({
      where,
      ...(include && { include }),
    });
  }

  /**
   * Find multiple records matching the criteria.
   *
   * @param options - Query options
   * @returns Array of matching records
   */
  async findMany(options?: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    include?: IncludeInput;
    skip?: number;
    take?: number;
  }): Promise<T[]> {
    return this.delegate.findMany(options || {});
  }

  /**
   * Find records with pagination.
   *
   * @param options - Query and pagination options
   * @returns Paginated result with metadata
   */
  async findManyPaginated(options?: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    include?: IncludeInput;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<T>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where: options?.where,
        orderBy: options?.orderBy,
        include: options?.include,
        skip,
        take: limit,
      }),
      this.delegate.count({ where: options?.where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Create a new record.
   *
   * @param data - The data to create
   * @param include - Optional relations to include in the result
   * @returns The created record
   */
  async create(data: CreateInput, include?: IncludeInput): Promise<T> {
    return this.delegate.create({
      data,
      ...(include && { include }),
    });
  }

  /**
   * Update a record by ID.
   *
   * @param id - The record ID
   * @param data - The data to update
   * @param include - Optional relations to include in the result
   * @returns The updated record
   */
  async update(
    id: string,
    data: UpdateInput,
    include?: IncludeInput,
  ): Promise<T> {
    return this.delegate.update({
      where: { id },
      data,
      ...(include && { include }),
    });
  }

  /**
   * Update the first record matching the criteria.
   *
   * @param where - Filter conditions
   * @param data - The data to update
   * @param include - Optional relations to include in the result
   * @returns The updated record
   */
  async updateWhere(
    where: WhereInput,
    data: UpdateInput,
    include?: IncludeInput,
  ): Promise<T> {
    return this.delegate.update({
      where,
      data,
      ...(include && { include }),
    });
  }

  /**
   * Delete a record by ID.
   *
   * @param id - The record ID
   * @returns The deleted record
   */
  async delete(id: string): Promise<T> {
    return this.delegate.delete({
      where: { id },
    });
  }

  /**
   * Count records matching the criteria.
   *
   * @param where - Optional filter conditions
   * @returns The count
   */
  async count(where?: WhereInput): Promise<number> {
    return this.delegate.count({ where });
  }

  /**
   * Check if a record exists.
   *
   * @param where - Filter conditions
   * @returns True if at least one record matches
   */
  async exists(where: WhereInput): Promise<boolean> {
    const count = await this.delegate.count({ where });
    return count > 0;
  }

  /**
   * Upsert a record (create or update).
   *
   * @param options - Upsert options
   * @returns The created or updated record
   */
  async upsert(options: {
    where: WhereInput;
    create: CreateInput;
    update: UpdateInput;
    include?: IncludeInput;
  }): Promise<T> {
    return this.delegate.upsert({
      where: options.where,
      create: options.create,
      update: options.update,
      ...(options.include && { include: options.include }),
    });
  }

  /**
   * Execute operations within a transaction.
   * Use this for operations that need to be atomic.
   *
   * @param fn - Function to execute within the transaction
   * @returns Result of the transaction function
   */
  async transaction<R>(fn: (prisma: PrismaService) => Promise<R>): Promise<R> {
    return this.prisma.$transaction(async (tx) => {
      // Cast the transaction client to PrismaService for compatibility
      return fn(tx as unknown as PrismaService);
    });
  }
}
