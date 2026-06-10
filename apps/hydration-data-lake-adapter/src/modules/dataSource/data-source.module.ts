import { Module } from '@nestjs/common';
import { DataSourceService } from './data-source.service';
import { ProvidersModule } from '../../providers/providers.module';
import { AssetEnhancementService } from './dataEnhancement/assets';

@Module({
  imports: [ProvidersModule],
  providers: [DataSourceService, AssetEnhancementService],
  exports: [DataSourceService, AssetEnhancementService],
})
export class DataSourceModule {}
