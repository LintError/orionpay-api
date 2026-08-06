import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @UseGuards(AuthGuard)
  @Post('send')
  async sendPayment(
    @Request() req,
    @Body()
    sendPaymentDto: {
      fromWalletId: string;
      toAddress: string;
      amount: number;
      currency: string;
    },
  ) {
    return this.paymentsService.initiateTransaction(
      req.user.id,
      sendPaymentDto.fromWalletId,
      sendPaymentDto.toAddress,
      sendPaymentDto.amount,
      sendPaymentDto.currency,
    );
  }

  @UseGuards(AuthGuard)
  @Get('transactions')
  async getMyTransactions(@Request() req) {
    return this.paymentsService.getUserTransactions(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Get('transactions/:id')
  async getTransactionDetails(@Request() req, @Param('id') id: string) {
    return this.paymentsService.getTransactionById(id, req.user.id);
  }
}
