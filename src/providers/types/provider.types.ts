import { AttemptStatus } from '../../payments/enums/attempt-status.enum';
import { ProviderCode } from '../enums/provider-code.enum';
import { ProviderErrorType } from '../enums/provider-error-type.enum';

export interface MockProviderOutcome {
  status: AttemptStatus;
  errorType?: ProviderErrorType;
}

export type MockOutcomes = Partial<Record<ProviderCode, MockProviderOutcome>>;

export interface ProviderAuthorizeRequest {
  amount: number;
  currency: string;
  merchantId: string;
  externalReference?: string | null;
}

export interface ProviderAuthorizationResponse {
  provider: ProviderCode;
  status: AttemptStatus;
  errorType?: ProviderErrorType;
  providerTransactionId?: string;
  message: string;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  code: ProviderCode;
  authorize(
    request: ProviderAuthorizeRequest,
    outcome?: MockProviderOutcome,
  ): Promise<ProviderAuthorizationResponse>;
}

