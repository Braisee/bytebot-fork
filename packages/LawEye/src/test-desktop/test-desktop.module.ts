import { Module } from '@nestjs/common';
import { TestDesktopController } from './test-desktop.controller';
import { DesktopModule } from '../desktop/desktop.module';

@Module({
  imports: [DesktopModule],
  controllers: [TestDesktopController],
})
export class TestDesktopModule {}

