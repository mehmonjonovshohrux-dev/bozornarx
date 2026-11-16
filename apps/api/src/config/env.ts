import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    OTP_HASH_PEPPER: z.string().min(32, 'OTP_HASH_PEPPER must be at least 32 characters'),
    /** comma separated list of browser origins allowed by CORS, e.g. https://bozornarx-web.onrender.com */
    WEB_ORIGIN: z.string().min(1, 'WEB_ORIGIN is required'),
    /** public web address used for links inside emails */
    APP_URL: z.string().url(),
    MAIL_MODE: z.enum(['apps_script', 'disabled']).default('disabled'),
    GAS_URL: z.string().url().optional(),
    GAS_SECRET: z.string().min(32).optional(),
    SMS_PROVIDER_MODE: z.enum(['mock']).default('mock'),
    SENTRY_DSN: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    EIMZO_MODE: z.enum(['disabled', 'enabled']).default('disabled'),
    EIMZO_API_URL: z.string().url().optional(),
    PAYMENT_PROVIDER_MODE: z.enum(['none']).default('none'),
    SWAGGER: z.enum(['true', 'false']).default('false'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  })
  .superRefine((v, ctx) => {
    if (v.MAIL_MODE === 'apps_script' && (!v.GAS_URL || !v.GAS_SECRET)) {
      ctx.addIssue({ code: 'custom', message: 'MAIL_MODE=apps_script requires GAS_URL and GAS_SECRET', path: ['GAS_URL'] });
    }
    if (v.EIMZO_MODE === 'enabled' && !v.EIMZO_API_URL) {
      ctx.addIssue({ code: 'custom', message: 'EIMZO_MODE=enabled requires EIMZO_API_URL', path: ['EIMZO_API_URL'] });
    }
    if (v.NODE_ENV === 'production' && v.MAIL_MODE === 'disabled') {
      ctx.addIssue({ code: 'custom', message: 'MAIL_MODE=disabled is not allowed in production (users could not verify their email)', path: ['MAIL_MODE'] });
    }
  });

export type Env = z.infer<typeof schema>;
export const ENV = Symbol('ENV');

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Print only variable names and messages, never values.
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
