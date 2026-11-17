import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http';
import { loadEnv } from './config/env';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const env = loadEnv(); // fails fast with a readable message if configuration is wrong
  const log = new Logger('bootstrap');

  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, sendDefaultPii: false });
    log.log('error monitoring (Sentry) enabled');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  app.set('trust proxy', env.TRUST_PROXY); // Render terminates TLS in front of us, needed for correct client IPs
  app.useBodyParser('json', { limit: '9mb' }); // file uploads travel as base64 JSON (see files module)
  app.use(helmet());
  // Account data must never be reused from a browser/proxy cache (another account on the same phone could otherwise see it). Routes that want caching (public images) set their own header after this.
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.enableCors({
    origin: env.WEB_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'x-client'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (env.SWAGGER === 'true') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('BozorNarx API').setVersion('0.1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, doc); // JSON for Flutter codegen at /docs-json
  }

  // Database must answer before we accept traffic.
  const prisma = app.get(PrismaService);
  try {
    await prisma.$connect();
    await prisma.ping(5000);
  } catch {
    log.error('cannot reach the database (check DATABASE_URL); exiting');
    process.exit(1);
  }
  const roleCount = await prisma.role.count();
  if (roleCount === 0) log.warn('no roles in the database: run "npm run seed:reference" (the container does this automatically)');

  await app.listen(env.PORT, '0.0.0.0');
  log.log(`listening on :${env.PORT} (${env.NODE_ENV})`);
}

void bootstrap();

