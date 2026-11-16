import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../files/files.service';
import { TradeModule } from '../trade/trade.module';
import { ContractsController, ContractsModerationController, DeliveryActController, DisputesController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { DisputesService } from './disputes.service';
import { EimzoService } from './eimzo.adapter';

// DisputesService needs OrdersService (trade); OrdersService needs ContractsService. The cycle is broken with forwardRef.
@Module({
  imports: [AuthModule, StorageModule, forwardRef(() => TradeModule)],
  controllers: [ContractsController, ContractsModerationController, DeliveryActController, DisputesController],
  providers: [ContractsService, DisputesService, EimzoService],
  exports: [ContractsService],
})
export class ContractsModule {}
