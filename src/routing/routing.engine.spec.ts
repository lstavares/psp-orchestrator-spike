import { AttemptStatus } from '../payments/enums/attempt-status.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { ProviderCode } from '../providers/enums/provider-code.enum';
import { ProviderErrorType } from '../providers/enums/provider-error-type.enum';
import { RoutingEngine } from './routing.engine';

describe('RoutingEngine', () => {
  it('orders active providers by in-memory priority', () => {
    const engine = new RoutingEngine();

    expect(engine.getRoutePlan()).toEqual([
      { provider: ProviderCode.A, priority: 1 },
      { provider: ProviderCode.B, priority: 2 },
      { provider: ProviderCode.C, priority: 3 },
    ]);
  });

  it('selects the next provider after a technical error', () => {
    const engine = new RoutingEngine();

    const firstProvider = engine.getNextProvider([]);
    expect(firstProvider?.provider).toBe(ProviderCode.A);

    expect(
      engine.shouldFallback({
        status: AttemptStatus.TECHNICAL_ERROR,
        errorType: ProviderErrorType.TIMEOUT,
      }),
    ).toBe(true);

    const nextProvider = engine.getNextProvider([ProviderCode.A]);
    expect(nextProvider?.provider).toBe(ProviderCode.B);
  });

  it('does not fallback after a business decline', () => {
    const engine = new RoutingEngine();

    const providerStatus = {
      status: AttemptStatus.BUSINESS_DECLINED,
      errorType: ProviderErrorType.INSUFFICIENT_FUNDS,
    };

    expect(engine.shouldFallback(providerStatus)).toBe(false);
    expect(engine.resolveTerminalPaymentStatus(providerStatus)).toBe(
      PaymentStatus.DECLINED,
    );
  });

  it('returns null when all providers have already been attempted', () => {
    const engine = new RoutingEngine();

    expect(
      engine.getNextProvider([ProviderCode.A, ProviderCode.B, ProviderCode.C]),
    ).toBeNull();
  });

  it('uses only active providers from custom in-memory config', () => {
    const engine = new RoutingEngine([
      { provider: ProviderCode.A, priority: 1, active: false },
      { provider: ProviderCode.C, priority: 2, active: true },
      { provider: ProviderCode.B, priority: 3, active: true },
    ]);

    expect(engine.getRoutePlan()).toEqual([
      { provider: ProviderCode.C, priority: 2 },
      { provider: ProviderCode.B, priority: 3 },
    ]);
  });
});

