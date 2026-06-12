import { BadRequestException, Injectable } from '@nestjs/common';
import { AttemptStatus } from '../payments/enums/attempt-status.enum';
import { ProviderCode } from './enums/provider-code.enum';
import {
  isBusinessErrorType,
  isTechnicalErrorType,
  ProviderErrorType,
} from './enums/provider-error-type.enum';
import { MockPaymentProvider } from './mock-payment.provider';
import {
  MockOutcomes,
  MockProviderOutcome,
  PaymentProvider,
} from './types/provider.types';

@Injectable()
export class ProvidersService {
  private readonly providers = new Map<ProviderCode, PaymentProvider>([
    [ProviderCode.A, new MockPaymentProvider(ProviderCode.A)],
    [ProviderCode.B, new MockPaymentProvider(ProviderCode.B)],
    [ProviderCode.C, new MockPaymentProvider(ProviderCode.C)],
  ]);

  getProvider(providerCode: ProviderCode): PaymentProvider {
    const provider = this.providers.get(providerCode);

    if (!provider) {
      throw new BadRequestException(`Unknown provider: ${providerCode}`);
    }

    return provider;
  }

  normalizeMockOutcomes(mockOutcomes: unknown): MockOutcomes {
    if (mockOutcomes === undefined || mockOutcomes === null) {
      return {};
    }

    if (!this.isRecord(mockOutcomes)) {
      throw new BadRequestException('mockOutcomes must be an object');
    }

    const normalized: MockOutcomes = {};

    for (const [providerKey, rawOutcome] of Object.entries(mockOutcomes)) {
      const provider = this.parseProvider(providerKey);
      normalized[provider] = this.normalizeOutcome(provider, rawOutcome);
    }

    return normalized;
  }

  private normalizeOutcome(
    provider: ProviderCode,
    rawOutcome: unknown,
  ): MockProviderOutcome {
    if (!this.isRecord(rawOutcome)) {
      throw new BadRequestException(
        `mockOutcomes.${provider} must contain status and optional errorType`,
      );
    }

    const status = this.parseAttemptStatus(provider, rawOutcome.status);
    const errorType = this.parseOptionalErrorType(provider, rawOutcome.errorType);

    if (status === AttemptStatus.APPROVED) {
      if (errorType !== undefined) {
        throw new BadRequestException(
          `mockOutcomes.${provider}.errorType is not allowed when status is APPROVED`,
        );
      }

      return { status };
    }

    if (status === AttemptStatus.TECHNICAL_ERROR) {
      const resolvedErrorType =
        errorType ?? ProviderErrorType.PROVIDER_UNAVAILABLE;

      if (!isTechnicalErrorType(resolvedErrorType)) {
        throw new BadRequestException(
          `mockOutcomes.${provider}.errorType must be a technical error for TECHNICAL_ERROR`,
        );
      }

      return { status, errorType: resolvedErrorType };
    }

    const resolvedErrorType = errorType ?? ProviderErrorType.DO_NOT_HONOR;

    if (!isBusinessErrorType(resolvedErrorType)) {
      throw new BadRequestException(
        `mockOutcomes.${provider}.errorType must be a business error for BUSINESS_DECLINED`,
      );
    }

    return { status, errorType: resolvedErrorType };
  }

  private parseProvider(provider: string): ProviderCode {
    if (Object.values(ProviderCode).includes(provider as ProviderCode)) {
      return provider as ProviderCode;
    }

    throw new BadRequestException(`Unknown provider in mockOutcomes: ${provider}`);
  }

  private parseAttemptStatus(provider: ProviderCode, status: unknown): AttemptStatus {
    if (Object.values(AttemptStatus).includes(status as AttemptStatus)) {
      return status as AttemptStatus;
    }

    throw new BadRequestException(
      `mockOutcomes.${provider}.status must be a valid AttemptStatus`,
    );
  }

  private parseOptionalErrorType(
    provider: ProviderCode,
    errorType: unknown,
  ): ProviderErrorType | undefined {
    if (errorType === undefined || errorType === null) {
      return undefined;
    }

    if (Object.values(ProviderErrorType).includes(errorType as ProviderErrorType)) {
      return errorType as ProviderErrorType;
    }

    throw new BadRequestException(
      `mockOutcomes.${provider}.errorType must be a valid ProviderErrorType`,
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

