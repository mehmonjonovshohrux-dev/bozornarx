import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ContractsModule } from '../contracts/contracts.module';
import { CartService } from './cart.service';
import { OffersService } from './offers.service';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { StoresService } from './stores.service';
import { CartController, OffersController, OrdersController, StoresController } from './trade.controller';

@Module({
  imports: [AuthModule, CatalogModule, forwardRef(() => ContractsModule)],
  controllers: [StoresController, CartController, OrdersController, OffersController],
  providers: [StoresService, CartService, OrdersService, PaymentsService, OffersService],
  exports: [OrdersService, CartService],
})
export class TradeModule {}
