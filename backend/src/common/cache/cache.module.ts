import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

/**
 * Global cache module that provides caching capabilities.
 *
 * Configuration:
 * - Uses Redis when REDIS_URL is set
 * - Falls back to in-memory cache when Redis is unavailable
 *
 * Usage:
 * - Inject CACHE_MANAGER in services
 * - Use @CacheInterceptor for automatic caching
 * - Use @CacheTTL(seconds) to customize TTL
 *
 * Example:
 * ```typescript
 * @Injectable()
 * export class RafflesService {
 *   constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}
 *
 *   async getRaffles() {
 *     const cached = await this.cache.get('raffles');
 *     if (cached) return cached;
 *     const raffles = await this.prisma.raffle.findMany();
 *     await this.cache.set('raffles', raffles, 300000); // 5 minutes
 *     return raffles;
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');

        // Use Redis if URL is configured
        if (redisUrl) {
          try {
            const store = await redisStore({
              url: redisUrl,
              ttl: 5 * 60 * 1000, // Default 5 minutes in ms
            });

            return {
              store,
              ttl: 5 * 60 * 1000,
            };
          } catch (error) {
            console.warn(
              'Redis connection failed, falling back to memory cache:',
              error,
            );
          }
        }

        // Fall back to in-memory cache
        return {
          ttl: 5 * 60 * 1000, // 5 minutes default TTL
          max: 1000, // Max items in cache
        };
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
