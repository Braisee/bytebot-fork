import { Module } from '@nestjs/common';
import { TestLlmController } from './test-llm.controller';
import { LlmModule } from '../llm/llm.module';
import { DesktopModule } from '../desktop/desktop.module';

@Module({
  imports: [LlmModule, DesktopModule],
  controllers: [TestLlmController],
})
export class TestLlmModule {}

