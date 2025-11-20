import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DesktopModule } from './desktop/desktop.module';
import { LlmModule } from './llm/llm.module';
import { TasksModule } from './tasks/tasks.module';
import { GatewayModule } from './gateway/gateway.module';
import { TestDesktopModule } from './test-desktop/test-desktop.module';
import { TestLlmModule } from './test-llm/test-llm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DesktopModule,
    LlmModule,
    TasksModule,
    GatewayModule,
    TestDesktopModule,
    TestLlmModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

