import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
} from 'class-validator';
import { MockProviderOutcome } from '../../providers/types/provider.types';
import { ProviderCode } from '../../providers/enums/provider-code.enum';

export class AuthorizePaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  currency: string;

  @IsString()
  @MinLength(1)
  merchantId: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsObject()
  mockOutcomes?: Partial<Record<ProviderCode, MockProviderOutcome>>;
}
