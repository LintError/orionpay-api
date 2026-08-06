import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('wallets')
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @UseGuards(AuthGuard)
  @Post()
  async createWallet(
    @Request() req,
    @Body() createWalletDto: { chain: string; currency: string },
  ) {
    return this.walletsService.createWallet(
      req.user.id,
      createWalletDto.chain,
      createWalletDto.currency,
    );
  }

  @UseGuards(AuthGuard)
  @Get()
  async getCurrentUserWallets(@Request() req) {
    return this.walletsService.getUserWallets(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  async getWalletById(@Request() req, @Param('id') id: string) {
    return this.walletsService.getWalletById(id, req.user.id);
  }

  @UseGuards(AuthGuard)
  @Post(':id/update-balance')
  async updateWalletBalance(@Param('id') id: string) {
    return this.walletsService.updateBalance(id);
  }
}
