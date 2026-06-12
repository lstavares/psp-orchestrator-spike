import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProvidersService } from '../providers/providers.service';
import { ProviderCode } from '../providers/enums/provider-code.enum';
import { RoutingEngine } from '../routing/routing.engine';
import { AuthorizePaymentDto } from './dto/authorize-payment.dto';
import {
  PaymentAttemptResponseDto,
  PaymentResponseDto,
  RoutingDecisionResponseDto,
} from './dto/payment-response.dto';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { Payment } from './entities/payment.entity';
import { RoutingDecision } from './entities/routing-decision.entity';
import { PaymentStatus } from './enums/payment-status.enum';

interface PaymentAttemptDraft {
  provider: ProviderCode;
  attemptOrder: number;
  status: PaymentAttempt['status'];
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
}

interface RoutingDecisionDraft {
  provider: ProviderCode;
  priority: number;
  reason: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly providersService: ProvidersService,
    private readonly routingEngine: RoutingEngine,
  ) {}

  async authorize(dto: AuthorizePaymentDto): Promise<PaymentResponseDto> {
    const mockOutcomes = this.providersService.normalizeMockOutcomes(
      dto.mockOutcomes,
    );
    const attemptedProviders: ProviderCode[] = [];
    const attemptDrafts: PaymentAttemptDraft[] = [];
    const routingDecisionDrafts: RoutingDecisionDraft[] = [];
    const baseProviderRequest = {
      amount: dto.amount,
      currency: dto.currency,
      merchantId: dto.merchantId,
      externalReference: dto.externalReference ?? null,
    };

    let finalStatus = PaymentStatus.FAILED;
    let attemptOrder = 1;

    while (true) {
      const selection = this.routingEngine.getNextProvider(attemptedProviders);

      if (!selection) {
        finalStatus = PaymentStatus.FAILED;
        break;
      }

      const provider = this.providersService.getProvider(selection.provider);
      const reason =
        attemptedProviders.length === 0
          ? 'Selected by in-memory priority routing'
          : 'Fallback after technical provider error';

      routingDecisionDrafts.push({
        provider: selection.provider,
        priority: selection.priority,
        reason,
      });

      const providerResponse = await provider.authorize(
        baseProviderRequest,
        mockOutcomes[selection.provider],
      );
      const requestPayload = {
        ...baseProviderRequest,
        provider: selection.provider,
      };

      attemptDrafts.push({
        provider: selection.provider,
        attemptOrder,
        status: providerResponse.status,
        requestPayload,
        responsePayload: providerResponse as unknown as Record<string, unknown>,
      });
      attemptedProviders.push(selection.provider);

      const terminalStatus =
        this.routingEngine.resolveTerminalPaymentStatus(providerResponse);

      if (terminalStatus !== null) {
        finalStatus = terminalStatus;
        break;
      }

      if (this.routingEngine.shouldFallback(providerResponse)) {
        attemptOrder += 1;
        continue;
      }

      finalStatus = PaymentStatus.FAILED;
      break;
    }

    const savedPayment = await this.persistPayment(
      dto,
      finalStatus,
      attemptDrafts,
      routingDecisionDrafts,
    );

    return this.toResponse(savedPayment);
  }

  async findById(id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: { attempts: true, routingDecisions: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    return this.toResponse(payment);
  }

  private async persistPayment(
    dto: AuthorizePaymentDto,
    status: PaymentStatus,
    attemptDrafts: PaymentAttemptDraft[],
    routingDecisionDrafts: RoutingDecisionDraft[],
  ): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const payment = manager.create(Payment, {
        amount: dto.amount,
        currency: dto.currency,
        merchantId: dto.merchantId,
        externalReference: dto.externalReference ?? null,
        status,
      });
      const savedPayment = await manager.save(Payment, payment);

      const attempts = attemptDrafts.map((attemptDraft) =>
        manager.create(PaymentAttempt, {
          ...attemptDraft,
          payment: savedPayment,
        }),
      );

      if (attempts.length > 0) {
        await manager.save(PaymentAttempt, attempts);
      }

      const routingDecisions = routingDecisionDrafts.map((decisionDraft) =>
        manager.create(RoutingDecision, {
          ...decisionDraft,
          payment: savedPayment,
        }),
      );

      if (routingDecisions.length > 0) {
        await manager.save(RoutingDecision, routingDecisions);
      }

      const hydratedPayment = await manager.findOne(Payment, {
        where: { id: savedPayment.id },
        relations: { attempts: true, routingDecisions: true },
      });

      if (!hydratedPayment) {
        throw new NotFoundException(`Payment ${savedPayment.id} not found`);
      }

      return hydratedPayment;
    });
  }

  private toResponse(payment: Payment): PaymentResponseDto {
    const attempts = [...(payment.attempts ?? [])].sort(
      (left, right) => left.attemptOrder - right.attemptOrder,
    );
    const routingDecisions = [...(payment.routingDecisions ?? [])].sort(
      (left, right) => left.priority - right.priority,
    );

    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      merchantId: payment.merchantId,
      externalReference: payment.externalReference,
      status: payment.status,
      attempts: attempts.map((attempt): PaymentAttemptResponseDto => ({
        id: attempt.id,
        provider: attempt.provider,
        attemptOrder: attempt.attemptOrder,
        status: attempt.status,
        requestPayload: attempt.requestPayload,
        responsePayload: attempt.responsePayload,
        createdAt: attempt.createdAt,
      })),
      routingDecisions: routingDecisions.map(
        (decision): RoutingDecisionResponseDto => ({
          id: decision.id,
          provider: decision.provider,
          priority: decision.priority,
          reason: decision.reason,
          createdAt: decision.createdAt,
        }),
      ),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

