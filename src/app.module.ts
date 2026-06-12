import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAttempt } from './payments/entities/payment-attempt.entity';
import { Payment } from './payments/entities/payment.entity';
import { RoutingDecision } from './payments/entities/routing-decision.entity';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_DATABASE ?? 'psp_orchestrator',
      entities: [Payment, PaymentAttempt, RoutingDecision],
      synchronize: process.env.TYPEORM_SYNCHRONIZE !== 'false',
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    PaymentsModule,
  ],
})
export class AppModule {}

