import { Module } from '@nestjs/common';
import { RoutingEngine } from './routing.engine';
import { DEFAULT_ROUTING_PROVIDERS } from './routing-provider.config';

@Module({
  providers: [
    RoutingEngine,
    {
      provide: 'ROUTING_PROVIDERS',
      useValue: DEFAULT_ROUTING_PROVIDERS,
    },
  ],
  exports: [RoutingEngine],
})
export class RoutingModule {}

