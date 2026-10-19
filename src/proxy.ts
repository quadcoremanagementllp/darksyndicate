import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from './lib/constants';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/facilities', '/pricing', '/booking', '/contact', '/membership'];
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];

async function getRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: 'dark-syndicate' });
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function rejectRequest(request: NextRequest, portal: 'admin' | 'staff' | 'player', status: 401 | 403) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: { message: status === 401 ? 'Authentication required' : 'You do not have access to this portal.' } },
      { status }
    );
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('portal', portal);
  if (request.nextUrl.pathname && !['/admin/login', '/staff/login'].includes(request.nextUrl.pathname)) {
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  }
  if (status === 403) loginUrl.searchParams.set('error', 'access');
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/_next') || pathname.includes('.') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const role = await getRole(request);
  if (role && AUTH_PATHS.includes(pathname) && !request.nextUrl.searchParams.has('portal')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname.startsWith('/api/admin') || pathname.startsWith('/admin')) {
    if (!role) return rejectRequest(request, 'admin', 401);
    // Allow staff to view bookings schedule
    if (pathname === '/api/admin/bookings' && role === 'STAFF') {
      return NextResponse.next();
    }
    if (!ADMIN_ROLES.includes(role)) return rejectRequest(request, 'admin', 403);
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/staff') || pathname.startsWith('/staff')) {
    if (!role) return rejectRequest(request, 'staff', 401);
    if (!STAFF_ROLES.includes(role)) return rejectRequest(request, 'staff', 403);
    return NextResponse.next();
  }

  if (pathname.startsWith('/account')) {
    if (!role) return rejectRequest(request, 'player', 401);
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/booking') || pathname.startsWith('/facilities/') || pathname.startsWith('/api/');
  if (!isPublic && !role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|fonts|logo).*)'],
};
