export const APP_NAME = 'ResumeIQ';
export const APP_VERSION = '1.0.0';

export const PLANS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export const PLAN_LIMITS = {
  free: {
    resumeUploads: 3,
    aiAnalyses: 5,
    jobMatches: 3,
    applications: 20,
  },
  pro: {
    resumeUploads: 50,
    aiAnalyses: 100,
    jobMatches: 50,
    applications: 500,
  },
  enterprise: {
    resumeUploads: -1,
    aiAnalyses: -1,
    jobMatches: -1,
    applications: -1,
  },
} as const;

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export const APPLICATION_STATUS = [
  'wishlist',
  'applied',
  'phone_screen',
  'interview',
  'technical',
  'offer',
  'rejected',
  'withdrawn',
  'accepted',
] as const;

export const ANALYSIS_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const FILE_LIMITS = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.docx'],
} as const;

export const AI_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
} as const;

export const SCORE_WEIGHTS = {
  formatting: 0.2,
  content: 0.3,
  atsCompatibility: 0.25,
  impact: 0.25,
} as const;
