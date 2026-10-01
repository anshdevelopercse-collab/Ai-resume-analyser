import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3001'), 10),
  clientUrl: optional('CLIENT_URL', 'http://localhost:5173'),

  db: {
    uri: optional('MONGODB_URI', 'mongodb://localhost:27017/resumeiq'),
  },

  jwt: {
    accessSecret: optional('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  ai: {
    provider: optional('AI_PROVIDER', 'demo'),
    anthropicApiKey: optional('ANTHROPIC_API_KEY'),
    anthropicModel: optional('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001'),
    openaiApiKey: optional('OPENAI_API_KEY'),
    openaiModel: optional('OPENAI_MODEL', 'gpt-4o-mini'),
    maxTokens: parseInt(optional('AI_MAX_TOKENS', '4096'), 10),
    timeout: parseInt(optional('AI_TIMEOUT_MS', '30000'), 10),
  },

  storage: {
    provider: optional('STORAGE_PROVIDER', 'local'),
    localPath: optional('STORAGE_LOCAL_PATH', path.join(process.cwd(), 'uploads')),
    s3Bucket: optional('S3_BUCKET'),
    s3Region: optional('S3_REGION', 'us-east-1'),
    s3AccessKey: optional('S3_ACCESS_KEY_ID'),
    s3SecretKey: optional('S3_SECRET_ACCESS_KEY'),
    s3Endpoint: optional('S3_ENDPOINT'),
  },

  email: {
    provider: optional('EMAIL_PROVIDER', 'console'),
    from: optional('EMAIL_FROM', 'noreply@resumeiq.dev'),
    smtpHost: optional('SMTP_HOST'),
    smtpPort: parseInt(optional('SMTP_PORT', '587'), 10),
    smtpUser: optional('SMTP_USER'),
    smtpPass: optional('SMTP_PASS'),
    sendgridApiKey: optional('SENDGRID_API_KEY'),
  },

  rateLimits: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    maxRequests: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
    authMax: parseInt(optional('AUTH_RATE_LIMIT_MAX', '10'), 10),
    uploadMax: parseInt(optional('UPLOAD_RATE_LIMIT_MAX', '5'), 10),
    aiMax: parseInt(optional('AI_RATE_LIMIT_MAX', '10'), 10),
  },

  isProduction: optional('NODE_ENV', 'development') === 'production',
  isDevelopment: optional('NODE_ENV', 'development') === 'development',
  isTest: optional('NODE_ENV', 'development') === 'test',

  // Set DISABLE_AUTH=true to skip login entirely (demo/testing only)
  disableAuth: optional('DISABLE_AUTH', 'false') === 'true',
};
