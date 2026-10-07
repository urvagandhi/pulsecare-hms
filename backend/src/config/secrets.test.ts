import { validateSecretsGuard, DEV_DEFAULT_JWT_SECRET, DEV_DEFAULT_JWT_REFRESH_SECRET, AppSecrets } from './secrets';
import { env } from './env';

describe('Secrets Guard (Task 1.5)', () => {
  const safeSecrets: AppSecrets = {
    MONGODB_URI: 'mongodb://localhost:27017/hms',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'super-secure-production-jwt-secret-xyz-12345678',
    JWT_REFRESH_SECRET: 'super-secure-production-refresh-secret-xyz-12345678',
    AWS_SES_FROM_EMAIL: 'noreply@pulsecare.com',
    AWS_S3_BUCKET: 'pulsecare-prod-bucket',
  };

  it('allows safe secrets in any environment', () => {
    expect(() => validateSecretsGuard(safeSecrets)).not.toThrow();
  });

  it('throws an error if production environment uses dev default JWT secrets', () => {
    // Temporarily simulate production NODE_ENV
    const originalEnv = env.NODE_ENV;
    (env as { NODE_ENV: string }).NODE_ENV = 'production';

    const unsafeSecrets: AppSecrets = {
      ...safeSecrets,
      JWT_SECRET: DEV_DEFAULT_JWT_SECRET,
    };

    expect(() => validateSecretsGuard(unsafeSecrets)).toThrow(
      /Production security guard tripped/
    );

    const unsafeRefresh: AppSecrets = {
      ...safeSecrets,
      JWT_REFRESH_SECRET: DEV_DEFAULT_JWT_REFRESH_SECRET,
    };

    expect(() => validateSecretsGuard(unsafeRefresh)).toThrow(
      /Production security guard tripped/
    );

    // Restore
    (env as { NODE_ENV: string }).NODE_ENV = originalEnv;
  });
});
