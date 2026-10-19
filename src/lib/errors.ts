// ─── Error Handling ─────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Application-specific error with HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── Common Error Factories ─────────────────────────────────────────────────

export class AuthError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// ─── API Error Response Handler ─────────────────────────────────────────────

interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: Record<string, string[]>;
  };
}

/**
 * Standard error response handler for API routes.
 * Prevents stack traces and internal details from leaking to clients.
 */
export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  // Zod validation errors
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.map(String).join('.');
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }

    return NextResponse.json(
      {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        },
      },
      { status: 400 }
    );
  }

  // Application errors (known, operational)
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
        },
      },
      { status: error.statusCode }
    );
  }

  // Unknown errors — log but don't expose internals
  console.error('Unhandled error:', error);
  return NextResponse.json(
    {
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    },
    { status: 500 }
  );
}

/**
 * Success response wrapper for consistency.
 */
export function apiSuccess<T>(data: T, status: number = 200, headers?: Record<string, string>) {
  return NextResponse.json({ success: true, data }, { status, headers });
}

/**
 * Paginated success response.
 */
export function apiPaginatedSuccess<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    },
  });
}
