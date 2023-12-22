import { Controller, Get, Header } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { NodeHealthIndicator } from './node/node.health';

@Controller('/health')
export class AppController {
  constructor(
    private node: NodeHealthIndicator,
    private health: HealthCheckService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Content-Type', 'application/json')
  @HealthCheck()
  check() {
    return this.health.check([() => this.node.isHealthy()]);
  }
}
