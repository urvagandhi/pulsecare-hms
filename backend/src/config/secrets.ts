import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { env } from './env';
import { logger } from '../middleware/requestLogger';

export interface AppSecrets {
  MONGODB_URI: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  AWS_SES_FROM_EMAIL: string;
  AWS_S3_BUCKET: string;
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
  if (env.NODE_ENV !== 'production') {
    // In development/test, secrets come from env vars directly
    const secrets: AppSecrets = {
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/hms',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      JWT_SECRET: process.env.JWT_SECRET ?? DEV_DEFAULT_JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? DEV_DEFAULT_JWT_REFRESH_SECRET,
      AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL ?? 'noreply@hms.local',
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET ?? 'hms-dev-bucket',
    };
    validateSecretsGuard(secrets);
    return secrets;
  }

  const client = new SecretsManagerClient({ region: env.AWS_REGION });
  const command = new GetSecretValueCommand({ SecretId: env.AWS_SECRET_NAME });

  try {
    const response = await client.send(command);
    if (!response.SecretString) throw new Error('Empty secret value');
    const secrets = JSON.parse(response.SecretString) as AppSecrets;
    validateSecretsGuard(secrets);
    return secrets;
  } catch (err) {
    logger.error('Failed to fetch secrets from AWS Secrets Manager', { error: (err as Error).message });
    throw err;
  }
}
