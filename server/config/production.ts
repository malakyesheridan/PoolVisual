/**
 * Production Deployment Configuration
 * 
 * Environment-specific configuration for production deployment
 * Includes monitoring, security, and performance optimizations
 */

export interface ProductionConfig {
  database: {
    url: string;
    ssl: boolean;
    poolSize: number;
  };
  security: {
    jwtSecret: string;
    sessionSecret: string;
    corsOrigin: string;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };
  email: {
    resendApiKey: string;
    fromEmail: string;
  };
  payment: {
    stripeSecretKey: string;
    stripePublishableKey: string;
    stripeWebhookSecret: string;
  };
  monitoring: {
    sentryDsn?: string;
    logrocketAppId?: string;
  };
  performance: {
    cacheTtl: number;
    maxConcurrentUploads: number;
    maxFileSize: string;
  };
  features: {
    underwaterV20: boolean;
    preciseMasks: boolean;
    assetLibrary: boolean;
    poolTemplates: boolean;
  };
}

export const getProductionConfig = (): ProductionConfig => {
  return {
    database: {
      url: process.env.DATABASE_URL || '',
      ssl: process.env.NODE_ENV === 'production',
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || '',
      sessionSecret: process.env.SESSION_SECRET || '',
      corsOrigin: process.env.CORS_ORIGIN || 'https://poolvisual.com',
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      },
    },
    email: {
      resendApiKey: process.env.RESEND_API_KEY || '',
      fromEmail: process.env.FROM_EMAIL || 'noreply@poolvisual.com',
    },
    payment: {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    monitoring: {
      sentryDsn: process.env.SENTRY_DSN,
      logrocketAppId: process.env.LOGROCKET_APP_ID,
    },
    performance: {
      cacheTtl: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour
      maxConcurrentUploads: parseInt(process.env.MAX_CONCURRENT_UPLOADS || '5'),
      maxFileSize: process.env.MAX_FILE_SIZE || '50MB',
    },
    features: {
      underwaterV20: process.env.VITE_PV_UNDERWATER_V20 === 'true',
      preciseMasks: process.env.VITE_PV_PRECISE_MASKS === 'true',
      assetLibrary: process.env.VITE_PV_ASSET_LIBRARY === 'true',
      poolTemplates: process.env.VITE_PV_POOL_TEMPLATES === 'true',
    },
  };
};

export const validateProductionConfig = (config: ProductionConfig): string[] => {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (!config.security.jwtSecret) {
    errors.push('JWT_SECRET is required');
  }

  if (!config.security.sessionSecret) {
    errors.push('SESSION_SECRET is required');
  }

  if (!config.email.resendApiKey) {
    errors.push('RESEND_API_KEY is required');
  }

  if (!config.payment.stripeSecretKey) {
    errors.push('STRIPE_SECRET_KEY is required');
  }

  if (!config.payment.stripeWebhookSecret) {
    errors.push('STRIPE_WEBHOOK_SECRET is required');
  }

  return errors;
};
