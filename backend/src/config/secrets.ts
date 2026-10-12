import { env } from './env';
import { logger } from '../middleware/requestLogger';

export interface AppSecrets {
  MONGODB_URI: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
}

export const DEV_DEFAULT_JWT_SECRET = 'dev-jwt-secret-change-in-production';
export const DEV_DEFAULT_JWT_REFRESH_SECRET = 'dev-refresh-secret-change-in-production';

export function validateSecretsGuard(secrets: AppSecrets): void {
  if (env.NODE_ENV === 'production') {
    if (
      !secrets.JWT_SECRET ||
      secrets.JWT_SECRET === DEV_DEFAULT_JWT_SECRET ||
      !secrets.JWT_REFRESH_SECRET ||
      secrets.JWT_REFRESH_SECRET === DEV_DEFAULT_JWT_REFRESH_SECRET
    ) {
      throw new Error(
        'FATAL: Production security guard tripped. JWT_SECRET and JWT_REFRESH_SECRET must not use dev default values in production mode.'
      );
    }
  }
}

export async function fetchSecrets(): Promise<AppSecrets> {
  const secrets: AppSecrets = {
    MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/hms',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    JWT_SECRET: process.env.JWT_SECRET ?? DEV_DEFAULT_JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? DEV_DEFAULT_JWT_REFRESH_SECRET,
  };
  validateSecretsGuard(secrets);
  return secrets;
}
