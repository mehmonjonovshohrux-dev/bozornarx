import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Render health check. 200 only when the database answers; 503 otherwise. Reveals no internal detail. */
  @Get()
  @SkipThrottle()
  async check() {
    try {
      await this.prisma.ping(3000);
    } catch {
      throw new AppError(503, 'DB_DOWN', 'Database unavailable');
    }
    return { status: 'ok', db: 'up', uptimeSec: Math.round(process.uptime()) };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
