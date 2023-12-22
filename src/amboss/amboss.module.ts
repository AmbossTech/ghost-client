import { Module } from '@nestjs/common';
import { AmbossService } from './amboss.service';

@Module({
  providers: [AmbossService],
  exports: [AmbossService],
})
export class AmbossModule {}
