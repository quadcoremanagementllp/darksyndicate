import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, type TokenPayload } from './auth';
import { AUTH_COOKIE_NAME } from './constants';
import { AuthError, ForbiddenError, handleApiError } from './errors';

// ─── Route Protection Middleware Helpers ─────────────────────────────────────

/**
 * Extract and verify the session from the request cookies.
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<TokenPayload | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Higher-order function to protect API routes with authentication.
 * Injects the session into the handler if valid.
 */
export function withAuth(
  handler: (
    request: NextRequest,
    session: TokenPayload,
    context?: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>,
  options?: { roles?: string[] }
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      const session = await getSessionFromRequest(request);

      if (!session) {
        throw new AuthError();
      }

      // Role-based check
      if (options?.roles && !options.roles.includes(session.role)) {
        throw new ForbiddenError();
      }

      return handler(request, session, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Protect route for admin-only access.
 */
export function withAdmin(
  handler: (
    request: NextRequest,
    session: TokenPayload,
    context?: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>
) {
  return withAuth(handler, { roles: ['SUPER_ADMIN', 'ADMIN'] });
}

/**
 * Protect route for staff and admin access.
 */
export function withStaff(
  handler: (
    request: NextRequest,
    session: TokenPayload,
    context?: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>
) {
  return withAuth(handler, { roles: ['SUPER_ADMIN', 'ADMIN', 'STAFF'] });
}
