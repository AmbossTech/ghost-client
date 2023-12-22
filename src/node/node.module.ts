import { Module } from '@nestjs/common';
import { NodeService } from './node.service';
import { AmbossModule } from 'src/amboss/amboss.module';
import { NodeHealthIndicator } from './node.health';

@Module({
  imports: [AmbossModule],
  providers: [NodeService, NodeHealthIndicator],
  exports: [NodeHealthIndicator],
})
export class NodeModule {}
