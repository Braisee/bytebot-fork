import { Module } from '@nestjs/common';
import { TasksGateway } from './gateway';
import { GatewayService } from './gateway.service';

@Module({
  providers: [TasksGateway, GatewayService],
  exports: [TasksGateway, GatewayService],
})
export class GatewayModule {}

