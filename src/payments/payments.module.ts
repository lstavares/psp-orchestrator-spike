import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvidersModule } from '../providers/providers.module';
import { RoutingModule } from '../routing/routing.module';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { Payment } from './entities/payment.entity';
import { RoutingDecision } from './entities/routing-decision.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentAttempt, RoutingDecision]),
    ProvidersModule,
    RoutingModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

