import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
