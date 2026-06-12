import { randomUUID } from 'crypto';
import { AttemptStatus } from '../payments/enums/attempt-status.enum';
import { ProviderCode } from './enums/provider-code.enum';
import { ProviderErrorType } from './enums/provider-error-type.enum';
import {
  MockProviderOutcome,
  PaymentProvider,
  ProviderAuthorizationResponse,
  ProviderAuthorizeRequest,
} from './types/provider.types';

export class MockPaymentProvider implements PaymentProvider {
  constructor(public readonly code: ProviderCode) {}

  async authorize(
    request: ProviderAuthorizeRequest,
    outcome: MockProviderOutcome = { status: AttemptStatus.APPROVED },
  ): Promise<ProviderAuthorizationResponse> {
    const providerTransactionId =
      outcome.status === AttemptStatus.APPROVED
        ? `${this.code}-${randomUUID()}`
        : undefined;

    return {
      provider: this.code,
      status: outcome.status,
      errorType: outcome.errorType,
      providerTransactionId,
      message: this.buildMessage(outcome),
      raw: {
        simulated: true,
        provider: this.code,
        amount: request.amount,
        currency: request.currency,
        receivedAt: new Date().toISOString(),
      },
    };
  }

  private buildMessage(outcome: MockProviderOutcome): string {
    if (outcome.status === AttemptStatus.APPROVED) {
      return `Authorized by mock provider ${this.code}`;
    }

    if (outcome.status === AttemptStatus.BUSINESS_DECLINED) {
      return `Business decline from mock provider ${this.code}: ${outcome.errorType}`;
    }

    return `Technical error from mock provider ${this.code}: ${
      outcome.errorType ?? ProviderErrorType.PROVIDER_UNAVAILABLE
    }`;
  }
}

