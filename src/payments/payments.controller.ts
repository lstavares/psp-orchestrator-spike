import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AuthorizePaymentDto } from './dto/authorize-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('authorize')
  authorize(@Body() dto: AuthorizePaymentDto): Promise<PaymentResponseDto> {
    return this.paymentsService.authorize(dto);
  }

  @Get(':id')
  findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.findById(id);
  }
}

