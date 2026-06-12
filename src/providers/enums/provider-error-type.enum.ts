export enum ProviderErrorType {
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_CARD = 'INVALID_CARD',
  INVALID_CVV = 'INVALID_CVV',
  DO_NOT_HONOR = 'DO_NOT_HONOR',
  FRAUD_SUSPECTED = 'FRAUD_SUSPECTED',
}

export const TECHNICAL_PROVIDER_ERROR_TYPES = new Set<ProviderErrorType>([
  ProviderErrorType.TIMEOUT,
  ProviderErrorType.NETWORK_ERROR,
  ProviderErrorType.PROVIDER_UNAVAILABLE,
]);

export const BUSINESS_PROVIDER_ERROR_TYPES = new Set<ProviderErrorType>([
  ProviderErrorType.INSUFFICIENT_FUNDS,
  ProviderErrorType.INVALID_CARD,
  ProviderErrorType.INVALID_CVV,
  ProviderErrorType.DO_NOT_HONOR,
  ProviderErrorType.FRAUD_SUSPECTED,
]);

export function isTechnicalErrorType(
  errorType: ProviderErrorType | undefined,
): boolean {
  return errorType !== undefined && TECHNICAL_PROVIDER_ERROR_TYPES.has(errorType);
}

export function isBusinessErrorType(
  errorType: ProviderErrorType | undefined,
): boolean {
  return errorType !== undefined && BUSINESS_PROVIDER_ERROR_TYPES.has(errorType);
}

