import { Module } from '@nestjs/common';
import { DesktopService } from './desktop.service';

@Module({
  providers: [DesktopService],
  exports: [DesktopService],
})
export class DesktopModule {}

