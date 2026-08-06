import { Controller, Get, UseGuards } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('blockchain')
export class BlockchainController {
  constructor(private blockchainService: BlockchainService) {}

  @UseGuards(AuthGuard)
  @Get('chains')
  getSupportedChains() {
    return {
      chains: this.blockchainService.getSupportedChains(),
    };
  }
}
