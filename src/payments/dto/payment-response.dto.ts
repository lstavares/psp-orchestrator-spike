import { ProviderCode } from '../../providers/enums/provider-code.enum';
import { AttemptStatus } from '../enums/attempt-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export interface PaymentAttemptResponseDto {
  id: string;
  provider: ProviderCode;
  attemptOrder: number;
  status: AttemptStatus;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  createdAt: Date;
}

export interface RoutingDecisionResponseDto {
  id: string;
  provider: ProviderCode;
  priority: number;
  reason: string;
  createdAt: Date;
}

export interface PaymentResponseDto {
  id: string;
  amount: number;
  currency: string;
  merchantId: string;
  externalReference: string | null;
  status: PaymentStatus;
  attempts: PaymentAttemptResponseDto[];
  routingDecisions: RoutingDecisionResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

