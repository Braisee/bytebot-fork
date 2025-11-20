import { Module } from '@nestjs/common';
import { DesktopService } from './desktop.service';

@Module({
  providers: [DesktopService],
  exports: [DesktopService], // Export pour permettre à TestDesktopModule de l'utiliser
})
export class DesktopModule {}

