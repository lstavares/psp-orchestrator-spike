import { Injectable } from '@nestjs/common';
import { AttemptStatus } from '../payments/enums/attempt-status.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { ProviderCode } from '../providers/enums/provider-code.enum';
import {
  isTechnicalErrorType,
  ProviderErrorType,
} from '../providers/enums/provider-error-type.enum';
import {
  DEFAULT_ROUTING_PROVIDERS,
  RoutingProviderConfig,
} from './routing-provider.config';

export interface RoutingSelection {
  provider: ProviderCode;
  priority: number;
}

export interface RoutingProviderResponse {
  status: AttemptStatus;
  errorType?: ProviderErrorType;
}

@Injectable()
export class RoutingEngine {
  constructor(
    private readonly providerConfig: RoutingProviderConfig[] =
      DEFAULT_ROUTING_PROVIDERS,
  ) {}

  getRoutePlan(): RoutingSelection[] {
    return [...this.providerConfig]
      .filter((provider) => provider.active)
      .sort((left, right) => left.priority - right.priority)
      .map(({ provider, priority }) => ({ provider, priority }));
  }

  getNextProvider(attemptedProviders: ProviderCode[]): RoutingSelection | null {
    const attempted = new Set(attemptedProviders);

    return (
      this.getRoutePlan().find(
        (selection) => !attempted.has(selection.provider),
      ) ?? null
    );
  }

  shouldFallback(response: RoutingProviderResponse): boolean {
    return (
      response.status === AttemptStatus.TECHNICAL_ERROR &&
      isTechnicalErrorType(response.errorType)
    );
  }

  resolveTerminalPaymentStatus(
    response: RoutingProviderResponse,
  ): PaymentStatus | null {
    if (response.status === AttemptStatus.APPROVED) {
      return PaymentStatus.AUTHORIZED;
    }

    if (response.status === AttemptStatus.BUSINESS_DECLINED) {
      return PaymentStatus.DECLINED;
    }

    return null;
  }
}

