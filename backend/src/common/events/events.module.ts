import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RaffleEventListener } from './raffle.listener';

/**
 * Events module for domain event handling.
 *
 * Provides event emission and listening capabilities across the application.
 * Events are used for:
 * - Decoupling services (e.g., raffle service doesn't need to know about notifications)
 * - Cross-cutting concerns (logging, analytics, audit trails)
 * - Asynchronous processing (non-blocking operations)
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Use wildcards to subscribe to multiple events
      wildcard: true,
      // Delimiter for namespaced events
      delimiter: '.',
      // Throw errors if listener throws
      ignoreErrors: false,
    }),
  ],
  providers: [RaffleEventListener],
  exports: [],
})
export class EventsModule {}
