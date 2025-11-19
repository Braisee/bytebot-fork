import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { DesktopModule } from '../desktop/desktop.module';
import { LlmModule } from '../llm/llm.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [DesktopModule, LlmModule, GatewayModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}

