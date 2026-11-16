import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import { ENV, Env } from '../config/env';

export interface SignatureCheck {
  valid: boolean;
  certSerial?: string;
  certSubject?: string;
  certValidFrom?: Date;
  certValidTo?: Date;
  /** RFC 3161 token if the provider returned one */
  timestampToken?: Buffer;
  detail?: Record<string, unknown>;
}

/**
 * E-IMZO verification port.
 *
 * What exists today: the interface and an honest "not configured" implementation. A document is NEVER marked as
 * signed without a verified PKCS#7. Drawn signatures or a clicked "I agree" button are not E-IMZO signatures here.
 *
 * What is needed to finish it (from the official E-IMZO / provider documentation, which this project does not have):
 *  - the verification service endpoint and its request/response format (EIMZO_API_URL),
 *  - credentials if the provider requires them,
 *  - the browser-side signing flow (E-IMZO client / extension) used by the web app to produce the PKCS#7.
 * Implement `verify` below, then set EIMZO_MODE=enabled.
 */
export interface VerifyInput {
  documentSha256: string;
  documentBytes: Buffer;
  pkcs7: Buffer;
}

export interface EimzoVerifier {
  readonly configured: boolean;
  verify(input: VerifyInput): Promise<SignatureCheck>;
}

@Injectable()
export class EimzoService implements EimzoVerifier {
  constructor(@Inject(ENV) private readonly env: Env) {}

  get configured(): boolean {
    return false; // flips to true only once a real verifier is implemented below
  }

  status() {
    return {
      mode: this.env.EIMZO_MODE,
      configured: this.configured,
      message: this.env.EIMZO_MODE === 'disabled'
        ? 'E-IMZO ulanmagan. Shartnomalar yaratiladi va PDF sifatida saqlanadi, lekin imzolash uchun rasmiy E-IMZO integratsiyasi kerak.'
        : 'EIMZO_MODE=enabled, lekin rasmiy tekshiruv protokoli hali kodga kiritilmagan (src/contracts/eimzo.adapter.ts).',
    };
  }

  verify(_input: VerifyInput): Promise<SignatureCheck> {
    if (this.env.EIMZO_MODE === 'disabled') {
      return Promise.reject(new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'E-IMZO integratsiyasi ulanmagan. Imzolash hozircha mumkin emas.'));
    }
    return Promise.reject(new AppError(501, 'ADAPTER_NOT_IMPLEMENTED', 'E-IMZO tekshiruv adapteri hali yozilmagan: rasmiy hujjat va kalitlar kerak.'));
  }
}
