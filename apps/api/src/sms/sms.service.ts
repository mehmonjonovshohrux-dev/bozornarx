import { Injectable, Module } from '@nestjs/common';
import { AppError } from '../common/app-error';

/**
 * SMS OTP adapter. No SMS provider has been chosen or contracted yet, so this adapter refuses honestly
 * instead of pretending to send. Replace `MockSmsService` with a real provider class when credentials exist.
 */
export interface SmsPort {
  assertConfigured(): void;
  send(phone: string, text: string): Promise<void>;
}

@Injectable()
export class MockSmsService implements SmsPort {
  assertConfigured(): void {
    throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Telefon tasdiqlash hali ulanmagan: SMS provayder sozlanmagan.');
  }
  async send(): Promise<void> {
    this.assertConfigured();
  }
}

@Module({ providers: [MockSmsService], exports: [MockSmsService] })
export class SmsModule {}
