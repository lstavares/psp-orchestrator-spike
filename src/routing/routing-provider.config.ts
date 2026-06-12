import { ProviderCode } from '../providers/enums/provider-code.enum';

export interface RoutingProviderConfig {
  provider: ProviderCode;
  priority: number;
  active: boolean;
}

export const DEFAULT_ROUTING_PROVIDERS: RoutingProviderConfig[] = [
  { provider: ProviderCode.A, priority: 1, active: true },
  { provider: ProviderCode.B, priority: 2, active: true },
  { provider: ProviderCode.C, priority: 3, active: true },
];

