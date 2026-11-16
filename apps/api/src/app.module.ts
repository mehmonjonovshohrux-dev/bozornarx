import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.controller';
import { AnalyticsModule } from './analytics/analytics.controller';
import { BuyerModule } from './buyer/buyer.controller';
import { CatalogModule } from './catalog/catalog.module';
import { ChatModule } from './chat/chat.controller';
import { ContractsModule } from './contracts/contracts.module';
import { FilesModule } from './files/files.controller';
import { MaintenanceModule } from './maintenance/maintenance.service';
import { NotificationsCoreModule } from './notifications/notifications.service';
import { NotificationsModule } from './notifications/notifications.controller';
import { StorageModule } from './files/files.service';
import { TradeModule } from './trade/trade.module';
import { AuditModule } from './audit/audit.service';
import { AuthModule } from './auth/auth.module';
import { AccessLogInterceptor, ResponseInterceptor } from './common/http';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.service';
import { UsersModule } from './users/me.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    HealthModule,
    AuthModule,
    UsersModule,
    NotificationsCoreModule,
    NotificationsModule,
    StorageModule,
    FilesModule,
    CatalogModule,
    TradeModule,
    ContractsModule,
    ChatModule,
    BuyerModule,
    AdminModule,
    AnalyticsModule,
    MaintenanceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
