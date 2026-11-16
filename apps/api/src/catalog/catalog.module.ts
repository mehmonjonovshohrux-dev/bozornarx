import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../files/files.service';
import { AlertsService } from './alerts.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PricesService } from './prices.service';
import { ProductsService } from './products.service';
import { RegionsService } from './regions.service';
import { CatalogManagementController } from './seller-catalog.controller';
import { TrustService } from './trust.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [CatalogController, CatalogManagementController],
  providers: [CatalogService, ProductsService, PricesService, TrustService, AlertsService, RegionsService],
  exports: [CatalogService, PricesService, TrustService, AlertsService, RegionsService],
})
export class CatalogModule {}
