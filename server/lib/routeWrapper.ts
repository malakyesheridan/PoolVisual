/**
 * Express route wrapper with comprehensive error handling and validation
 * Provides standardized request/response handling across all API routes
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { AppError, isAppError, parseError } from './errors.js';
import { logger } from './logger.js';
import { validate } from '../../shared/schemas';

// Extend Express Request to include parsed data and metadata
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      userId?: string;
      organizationId?: string;
      validatedBody?: unknown;
      validatedParams?: unknown;
      validatedQuery?: unknown;
    }
  }
}

// Request size limits
const REQUEST_SIZE_LIMITS = {
  json: '10mb',
  urlencoded: '10mb',
  raw: '50mb' // For file uploads
};

// Handler configuration
interface HandlerConfig {
  authRequired?: boolean;
  bodySchema?: z.ZodSchema;
  paramsSchema?: z.ZodSchema;
  querySchema?: z.ZodSchema;
  maxRequestSize?: keyof typeof REQUEST_SIZE_LIMITS;
  timeout?: number; // Request timeout in milliseconds
}

// Handler function signature
type HandlerFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

/**
 * Parse and validate request body safely
 */
function parseRequestBody(req: Request, maxSize: keyof typeof REQUEST_SIZE_LIMITS = 'json'): unknown {
  const contentType = req.get('content-type') || '';
  const limit = REQUEST_SIZE_LIMITS[maxSize];

  try {
    if (contentType.includes('application/json')) {
      if (typeof req.body === 'string') {
        if (req.body.length > parseInt(limit)) {
          throw new AppError('VALIDATION_ERROR', 'Request body too large');
        }
        return JSON.parse(req.body);
      }
      return req.body;
    }
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return req.body;
    }
    
    if (contentType.includes('multipart/form-data')) {
      return req.body;
    }
    
    // Raw body handling
    if (req.body) {
      return req.body;
    }
    
    return {};
  } catch (error) {
    throw new AppError('VALIDATION_ERROR', 'Invalid request body format', { cause: error });
  }
}

/**
 * Check if user is authenticated
 */
function checkAuthentication(req: Request): void {
  // This should integrate with your existing auth system
  // For now, we'll check for a simple session or JWT
  const isAuthenticated = req.session?.user || req.headers.authorization;
  
  if (!isAuthenticated) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }
  
  // Set user context from session/token
  if (req.session?.user) {
    req.userId = req.session.user.id;
    req.organizationId = req.session.user.organizationId;
  }
}

/**
 * Main route wrapper function
 */
export function withHandler(handler: HandlerFunction, config: HandlerConfig = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Generate request ID for tracing
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Set up request timeout
    if (config.timeout) {
      req.setTimeout(config.timeout, () => {
        const error = new AppError('TIMEOUT_ERROR', 'Request timeout', { requestId });
        handleError(error, req, res);
      });
    }

    const startTime = process.hrtime.bigint();

    try {
      // Log incoming request
      logger.info({
        msg: 'Incoming request',
        requestId,
        meta: {
          method: req.method,
          url: req.url,
          userAgent: req.get('user-agent'),
          ip: req.ip
        }
      });

      // Parse request body
      const rawBody = parseRequestBody(req, config.maxRequestSize);

      // Check authentication if required
      if (config.authRequired) {
        checkAuthentication(req);
      }

      // Validate request data
      if (config.bodySchema) {
        req.validatedBody = validate(config.bodySchema, rawBody);
      }

      if (config.paramsSchema) {
        req.validatedParams = validate(config.paramsSchema, req.params);
      }

      if (config.querySchema) {
        req.validatedQuery = validate(config.querySchema, req.query);
      }

      // Execute handler
      const result = await handler(req, res, next);

      // Only send response if handler didn't already respond
      if (!res.headersSent) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds
        
        // Log successful response
        const logData: any = {
          msg: 'Request completed successfully',
          requestId,
          meta: {
            method: req.method,
            url: req.url,
            statusCode: 200,
            duration: `${duration.toFixed(2)}ms`
          }
        };
        
        if (req.userId) logData.userId = req.userId;
        if (req.organizationId) logData.organizationId = req.organizationId;
        
        logger.info(logData);

        res.status(200).json({
          ok: true,
          data: result,
          requestId
        });
      }
    } catch (error) {
      handleError(error, req, res, startTime);
    }
  };
}

/**
 * Centralized error handling
 */
function handleError(
  error: unknown,
  req: Request,
  res: Response,
  startTime?: bigint
): void {
  const requestId = req.requestId;
  const appError = isAppError(error) ? error : parseError(error, requestId);
  
  // Calculate request duration if available
  const duration = startTime 
    ? Number(process.hrtime.bigint() - startTime) / 1000000
    : undefined;

  // Log error with context
  const errorLogData: any = {
    msg: 'Request failed',
    code: appError.code,
    err: appError,
    requestId,
    meta: {
      method: req.method,
      url: req.url,
      statusCode: appError.getStatusCode(),
      duration: duration ? `${duration.toFixed(2)}ms` : undefined,
      userAgent: req.get('user-agent'),
      ip: req.ip
    }
  };
  
  if (req.userId) errorLogData.userId = req.userId;
  if (req.organizationId) errorLogData.organizationId = req.organizationId;
  
  logger.error(errorLogData);

  // Don't send response if already sent
  if (res.headersSent) {
    return;
  }

  // Send error response
  const statusCode = appError.getStatusCode();
  const errorResponse = appError.toApiResponse();

  res.status(statusCode).json(errorResponse);
}

/**
 * Middleware for global error handling
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(error);
  }
  
  handleError(error, req, res);
}

/**
 * Middleware for 404 handling
 */
export function notFoundHandler(req: Request, res: Response): void {
  const error = new AppError('NOT_FOUND', `Route ${req.method} ${req.path} not found`, {
    requestId: req.requestId
  });
  
  handleError(error, req, res);
}

/**
 * Middleware to add request ID to all requests
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.requestId) {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
  }
  next();
}