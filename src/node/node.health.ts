import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { NodeService } from './node.service';

@Injectable()
export class NodeHealthIndicator extends HealthIndicator {
  constructor(private nodeService: NodeService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const isHealthy = this.nodeService.isConnected;

    const result = this.getStatus('node', isHealthy);

    if (isHealthy) {
      return result;
    }
    throw new HealthCheckError('Node healthcheck failed', result);
  }
}
